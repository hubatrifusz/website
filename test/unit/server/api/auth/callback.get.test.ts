import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Arctic mock — must be declared before the handler is imported.
// vi.mock is hoisted to run before any other code in the file.
// ---------------------------------------------------------------------------
const mockValidateAuthorizationCode = vi.fn()
const mockCreateAuthorizationURL = vi.fn()
// Use a regular function (not arrow) so it can be invoked with `new`
const MockGoogle = vi.fn(function GoogleMock(this: unknown) {
  return {
    validateAuthorizationCode: mockValidateAuthorizationCode,
    createAuthorizationURL: mockCreateAuthorizationURL,
  }
})
const mockDecodeIdToken = vi.fn()
const mockGenerateState = vi.fn(() => 'mock-state')
const mockGenerateCodeVerifier = vi.fn(() => 'mock-verifier')

class MockOAuth2RequestError extends Error {
  code: string
  constructor(code: string) {
    super(`OAuth2RequestError: ${code}`)
    this.code = code
    this.name = 'OAuth2RequestError'
  }
}

class MockArcticFetchError extends Error {
  constructor(cause: unknown) {
    super('ArcticFetchError')
    this.name = 'ArcticFetchError'
    void cause
  }
}

vi.mock('arctic', () => ({
  Google: MockGoogle,
  generateState: mockGenerateState,
  generateCodeVerifier: mockGenerateCodeVerifier,
  decodeIdToken: mockDecodeIdToken,
  OAuth2RequestError: MockOAuth2RequestError,
  ArcticFetchError: MockArcticFetchError,
}))

// ---------------------------------------------------------------------------
// DB mock — sessions.insert is called by the happy-path handler.
// The handler accesses `db` as a Nuxt auto-import global, so we stub the
// global AND mock the module to cover both access patterns.
// ---------------------------------------------------------------------------
const mockDbInsertValues = vi.fn().mockResolvedValue(undefined)
const mockDbInsertBuilder = vi.fn(() => ({ values: mockDbInsertValues }))
const mockDb = {
  insert: mockDbInsertBuilder,
}

vi.mock('~~/server/utils/db', () => ({
  db: mockDb,
}))

vi.stubGlobal('db', mockDb)

vi.mock('~~/server/db/schema', () => ({
  sessions: {
    id: 'sessions_id_col',
    userId: 'sessions_userId_col',
    expiresAt: 'sessions_expiresAt_col',
  },
  users: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  gt: vi.fn((a, b) => ({ type: 'gt', a, b })),
}))

// ---------------------------------------------------------------------------
// findOrCreateGoogleUser mock
// ---------------------------------------------------------------------------
const mockFindOrCreateGoogleUser = vi.fn()
vi.mock('~~/server/utils/user', () => ({
  findOrCreateGoogleUser: mockFindOrCreateGoogleUser,
}))

// ---------------------------------------------------------------------------
// H3 global stubs
// ---------------------------------------------------------------------------
type CookieOptions = {
  path?: string
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
  expires?: Date
}

interface QueryParams {
  [key: string]: string | undefined
}

interface MockEvent {
  cookies: Record<string, string>
  setCookieCalls: Array<{ name: string; value: string; options: CookieOptions }>
  deletedCookies: string[]
  redirectUrl: string | null
  responseStatus: number | null
  query: QueryParams
  node: { req: Record<string, unknown>; res: Record<string, unknown> }
  context: Record<string, unknown>
}

function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    cookies: {},
    setCookieCalls: [],
    deletedCookies: [],
    redirectUrl: null,
    responseStatus: null,
    query: {},
    node: { req: {}, res: {} },
    context: {},
    ...overrides,
  }
}

let capturedHandler: ((event: MockEvent) => Promise<unknown>) | null = null

vi.stubGlobal('defineEventHandler', (fn: (event: MockEvent) => Promise<unknown>) => {
  capturedHandler = fn
  return fn
})

vi.stubGlobal(
  'setCookie',
  (event: MockEvent, name: string, value: string, options: CookieOptions) => {
    event.setCookieCalls.push({ name, value, options })
  },
)

vi.stubGlobal('getCookie', (event: MockEvent, name: string) => event.cookies[name])

vi.stubGlobal('deleteCookie', (event: MockEvent, name: string) => {
  event.deletedCookies.push(name)
})

vi.stubGlobal('sendRedirect', (event: MockEvent, url: string, status = 302) => {
  event.redirectUrl = url
  event.responseStatus = status
  return { location: url, status }
})

vi.stubGlobal('getQuery', (event: MockEvent) => event.query)

// H3Error stub — must match `instanceof H3Error` check in the handler.
class H3ErrorStub extends Error {
  statusCode: number
  statusMessage: string
  isH3Error = true
  constructor(opts: { statusCode?: number; statusMessage?: string } = {}) {
    super(opts.statusMessage ?? 'H3Error')
    this.statusCode = opts.statusCode ?? 500
    this.statusMessage = opts.statusMessage ?? ''
  }
}
vi.stubGlobal('H3Error', H3ErrorStub)

// createError produces instances that are instanceof H3Error
vi.stubGlobal(
  'createError',
  (opts: { status?: number; statusCode?: number; statusMessage?: string }) => {
    return new H3ErrorStub({
      statusCode: opts.status ?? opts.statusCode ?? 500,
      statusMessage: opts.statusMessage ?? '',
    })
  },
)

// ---------------------------------------------------------------------------
// Import handler via relative path — ensures arctic mock is applied correctly.
// ---------------------------------------------------------------------------
await import('../../../../../server/api/auth/callback.get')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTokens(
  opts: { hasRefreshToken?: boolean; refreshToken?: string; idToken?: string } = {},
) {
  return {
    idToken: vi.fn(() => opts.idToken ?? 'mock.id.token'),
    hasRefreshToken: vi.fn(() => opts.hasRefreshToken ?? false),
    refreshToken: vi.fn(() => opts.refreshToken ?? 'mock-refresh-token'),
  }
}

const validGoogleUser = {
  sub: 'google-sub-123',
  email: 'test@example.com',
  name: 'Test User',
  email_verified: true,
}

const validDbUser = { userId: 'test-uuid-1234' }

describe('GET /api/auth/callback (OAuth Callback)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore mock chain structures after clearAllMocks
    MockGoogle.mockImplementation(function (this: unknown) {
      return {
        validateAuthorizationCode: mockValidateAuthorizationCode,
        createAuthorizationURL: mockCreateAuthorizationURL,
      }
    })
    mockDbInsertValues.mockResolvedValue(undefined)
    mockDbInsertBuilder.mockImplementation(() => ({ values: mockDbInsertValues }))
    // Restore db global reference in case tests clear it
    vi.stubGlobal('db', mockDb)
  })

  // -------------------------------------------------------------------------
  // Success path
  // -------------------------------------------------------------------------
  describe('success path', () => {
    it('exchanges the code for tokens, resolves the user, and redirects to /', async () => {
      mockValidateAuthorizationCode.mockResolvedValue(makeTokens())
      mockDecodeIdToken.mockReturnValue(validGoogleUser)
      mockFindOrCreateGoogleUser.mockResolvedValue(validDbUser)

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier-value',
        },
      })

      await capturedHandler!(event)

      expect(mockValidateAuthorizationCode).toHaveBeenCalledWith('auth-code', 'code-verifier-value')
      expect(mockFindOrCreateGoogleUser).toHaveBeenCalledWith(validGoogleUser, undefined)
      expect(event.redirectUrl).toBe('/')
    })

    it('sets the app_session_id cookie as httpOnly with sameSite=lax', async () => {
      mockValidateAuthorizationCode.mockResolvedValue(makeTokens())
      mockDecodeIdToken.mockReturnValue(validGoogleUser)
      mockFindOrCreateGoogleUser.mockResolvedValue(validDbUser)

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await capturedHandler!(event)

      const sessionCookie = event.setCookieCalls.find((c) => c.name === 'app_session_id')
      expect(sessionCookie).toBeDefined()
      expect(sessionCookie!.options.httpOnly).toBe(true)
      expect(sessionCookie!.options.sameSite).toBe('lax')
      expect(sessionCookie!.options.path).toBe('/')
    })

    it('stores the SHA-256 hash of the raw session ID in db.insert, not the raw id', async () => {
      mockValidateAuthorizationCode.mockResolvedValue(makeTokens())
      mockDecodeIdToken.mockReturnValue(validGoogleUser)
      mockFindOrCreateGoogleUser.mockResolvedValue(validDbUser)

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await capturedHandler!(event)

      const sessionCookie = event.setCookieCalls.find((c) => c.name === 'app_session_id')!
      const rawSessionId = sessionCookie.value
      const expectedHash = createHash('sha256').update(rawSessionId).digest('hex')

      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expectedHash,
          userId: validDbUser.userId,
        }),
      )
      // The raw and hashed values must differ
      expect(rawSessionId).not.toBe(expectedHash)
    })

    it('passes the refreshToken to findOrCreateGoogleUser when hasRefreshToken is true', async () => {
      mockValidateAuthorizationCode.mockResolvedValue(
        makeTokens({ hasRefreshToken: true, refreshToken: 'real-refresh-token' }),
      )
      mockDecodeIdToken.mockReturnValue(validGoogleUser)
      mockFindOrCreateGoogleUser.mockResolvedValue(validDbUser)

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await capturedHandler!(event)

      expect(mockFindOrCreateGoogleUser).toHaveBeenCalledWith(validGoogleUser, 'real-refresh-token')
    })

    it('passes undefined refreshToken when hasRefreshToken is false', async () => {
      mockValidateAuthorizationCode.mockResolvedValue(makeTokens({ hasRefreshToken: false }))
      mockDecodeIdToken.mockReturnValue(validGoogleUser)
      mockFindOrCreateGoogleUser.mockResolvedValue(validDbUser)

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await capturedHandler!(event)

      expect(mockFindOrCreateGoogleUser).toHaveBeenCalledWith(validGoogleUser, undefined)
    })

    it('deletes both OAuth cookies before processing the callback', async () => {
      mockValidateAuthorizationCode.mockResolvedValue(makeTokens())
      mockDecodeIdToken.mockReturnValue(validGoogleUser)
      mockFindOrCreateGoogleUser.mockResolvedValue(validDbUser)

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await capturedHandler!(event)

      expect(event.deletedCookies).toContain('google_oauth_state')
      expect(event.deletedCookies).toContain('google_oauth_code_verifier')
    })
  })

  // -------------------------------------------------------------------------
  // Failure paths
  // -------------------------------------------------------------------------
  describe('failure paths', () => {
    it('redirects to /login?error=access_denied when query.error is present', async () => {
      const event = createMockEvent({
        query: { error: 'access_denied', state: 'some-state' },
        cookies: {
          google_oauth_state: 'some-state',
          google_oauth_code_verifier: 'some-verifier',
        },
      })

      await capturedHandler!(event)

      expect(event.redirectUrl).toBe('/login?error=access_denied')
      expect(mockValidateAuthorizationCode).not.toHaveBeenCalled()
    })

    it('throws 400 when the state query param is missing', async () => {
      const event = createMockEvent({
        query: { code: 'auth-code' }, // no state
        cookies: {
          google_oauth_state: 'stored-state',
          google_oauth_code_verifier: 'stored-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringContaining('Security check failed'),
      })
    })

    it('throws 400 when the code query param is missing', async () => {
      const event = createMockEvent({
        query: { state: 'matching-state' }, // no code
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'stored-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringContaining('Security check failed'),
      })
    })

    it('throws 400 when query state does not match the stored state cookie (state mismatch)', async () => {
      const event = createMockEvent({
        query: { code: 'auth-code', state: 'wrong-state' },
        cookies: {
          google_oauth_state: 'correct-state',
          google_oauth_code_verifier: 'stored-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringContaining('Security check failed'),
      })
    })

    it('throws 400 when the stored state cookie is absent', async () => {
      const event = createMockEvent({
        query: { code: 'auth-code', state: 'some-state' },
        cookies: {
          // google_oauth_state NOT set
          google_oauth_code_verifier: 'stored-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringContaining('Security check failed'),
      })
    })

    it('throws 400 when the stored code verifier cookie is absent', async () => {
      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          // google_oauth_code_verifier NOT set
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: expect.stringContaining('Security check failed'),
      })
    })

    it('throws 401 when Google profile has email_verified: false', async () => {
      mockValidateAuthorizationCode.mockResolvedValue(makeTokens())
      mockDecodeIdToken.mockReturnValue({ ...validGoogleUser, email_verified: false })

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Email not verified by Google.',
      })
    })

    it('throws 400 with "Google rejected the authorization code." on OAuth2RequestError', async () => {
      mockValidateAuthorizationCode.mockRejectedValue(new MockOAuth2RequestError('invalid_grant'))

      const event = createMockEvent({
        query: { code: 'bad-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Google rejected the authorization code.',
      })
    })

    it('throws 400 with "Failed to fetch authentication." on ArcticFetchError', async () => {
      mockValidateAuthorizationCode.mockRejectedValue(
        new MockArcticFetchError(new Error('network error')),
      )

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Failed to fetch authentication.',
      })
    })

    it('throws 500 on unexpected errors from validateAuthorizationCode', async () => {
      mockValidateAuthorizationCode.mockRejectedValue(new Error('Unexpected DB error'))

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      await expect(capturedHandler!(event)).rejects.toMatchObject({
        statusCode: 500,
        statusMessage: 'Internal authentication handshake failed.',
      })
    })

    it('re-throws H3Error instances directly without wrapping them in a 500', async () => {
      // The email_verified: false path throws a 401 H3Error inside the try block.
      // The catch block should re-throw it as-is, not wrap as 500.
      mockValidateAuthorizationCode.mockResolvedValue(makeTokens())
      mockDecodeIdToken.mockReturnValue({ ...validGoogleUser, email_verified: false })

      const event = createMockEvent({
        query: { code: 'auth-code', state: 'matching-state' },
        cookies: {
          google_oauth_state: 'matching-state',
          google_oauth_code_verifier: 'code-verifier',
        },
      })

      const thrown = (await capturedHandler!(event).catch((e) => e)) as {
        statusCode: number
        statusMessage: string
      }

      expect(thrown.statusCode).toBe(401)
      expect(thrown.statusMessage).toBe('Email not verified by Google.')
    })
  })
})
