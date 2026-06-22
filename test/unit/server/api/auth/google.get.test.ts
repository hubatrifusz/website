import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock arctic BEFORE the handler module is imported. The handler reads env
// vars and instantiates arctic.Google at module-init time (top-level code),
// so the mock must be hoisted before any import runs.
// ---------------------------------------------------------------------------
const mockCreateAuthorizationURL = vi.fn()
const mockGenerateState = vi.fn(() => 'mock-state-value')
const mockGenerateCodeVerifier = vi.fn(() => 'mock-code-verifier-value')
// Use a real function (not arrow) so it can be called with `new`
const MockGoogle = vi.fn(function GoogleMock(this: unknown) {
  return { createAuthorizationURL: mockCreateAuthorizationURL }
})

vi.mock('arctic', () => ({
  Google: MockGoogle,
  generateState: mockGenerateState,
  generateCodeVerifier: mockGenerateCodeVerifier,
}))

// ---------------------------------------------------------------------------
// H3 global stubs — Nuxt auto-injects these in the Nitro runtime.
// In a plain 'node' test environment we must provide them ourselves.
// ---------------------------------------------------------------------------
type CookieOptions = {
  path?: string
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
  expires?: Date
}

interface MockEvent {
  cookies: Record<string, string>
  setCookieCalls: Array<{ name: string; value: string; options: CookieOptions }>
  redirectUrl: string | null
  responseStatus: number | null
  node: { req: Record<string, unknown>; res: Record<string, unknown> }
  context: Record<string, unknown>
}

function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    cookies: {},
    setCookieCalls: [],
    redirectUrl: null,
    responseStatus: null,
    node: { req: {}, res: {} },
    context: {},
    ...overrides,
  }
}

// We collect the handler function registered by defineEventHandler.
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

vi.stubGlobal('sendRedirect', (event: MockEvent, url: string, status = 302) => {
  event.redirectUrl = url
  event.responseStatus = status
  return { location: url, status }
})

vi.stubGlobal('getCookie', (event: MockEvent, name: string) => event.cookies[name])
vi.stubGlobal('deleteCookie', (_event: MockEvent, _name: string) => {})
vi.stubGlobal('getQuery', (_event: MockEvent) => ({}))

vi.stubGlobal(
  'createError',
  (opts: { status?: number; statusCode?: number; statusMessage?: string }) => {
    const err = new Error(opts.statusMessage ?? 'Error') as Error & {
      statusCode: number
      statusMessage: string
    }
    err.statusCode = opts.status ?? opts.statusCode ?? 500
    err.statusMessage = opts.statusMessage ?? ''
    return err
  },
)

class H3ErrorStub extends Error {
  statusCode: number
  statusMessage: string
  constructor(opts: { statusCode?: number; statusMessage?: string } = {}) {
    super(opts.statusMessage ?? 'H3Error')
    this.statusCode = opts.statusCode ?? 500
    this.statusMessage = opts.statusMessage ?? ''
  }
}
vi.stubGlobal('H3Error', H3ErrorStub)

// ---------------------------------------------------------------------------
// Import the handler using a RELATIVE path.
// This bypasses the ~~ shim and loads the source directly, ensuring the
// handler's `import * as arctic from 'arctic'` sees our vi.mock('arctic').
// The env vars set in test/setup.ts are already in place.
// ---------------------------------------------------------------------------
await import('../../../../../server/api/auth/google.get')

describe('GET /api/auth/google (Login Initiation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-set implementations that clearAllMocks wiped (it clears usage data
    // but implementations set via vi.fn(impl) or mockImplementation persist;
    // using mockReturnValue here is belt-and-suspenders).
    mockGenerateState.mockReturnValue('mock-state-value')
    mockGenerateCodeVerifier.mockReturnValue('mock-code-verifier-value')
    MockGoogle.mockImplementation(function (this: unknown) {
      return { createAuthorizationURL: mockCreateAuthorizationURL }
    })
  })

  it('calls arctic.generateState() and arctic.generateCodeVerifier()', async () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    mockCreateAuthorizationURL.mockReturnValue(authUrl)

    const event = createMockEvent()
    await capturedHandler!(event)

    expect(mockGenerateState).toHaveBeenCalledOnce()
    expect(mockGenerateCodeVerifier).toHaveBeenCalledOnce()
  })

  it('calls google.createAuthorizationURL with state, codeVerifier, and openid scopes', async () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    mockCreateAuthorizationURL.mockReturnValue(authUrl)

    const event = createMockEvent()
    await capturedHandler!(event)

    expect(mockCreateAuthorizationURL).toHaveBeenCalledWith(
      'mock-state-value',
      'mock-code-verifier-value',
      ['openid', 'profile', 'email'],
    )
  })

  it('appends access_type=offline and prompt=consent to the authorization URL', async () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    mockCreateAuthorizationURL.mockReturnValue(authUrl)

    const event = createMockEvent()
    await capturedHandler!(event)

    expect(authUrl.searchParams.get('access_type')).toBe('offline')
    expect(authUrl.searchParams.get('prompt')).toBe('consent')
  })

  it('sets the google_oauth_state cookie with maxAge=600, httpOnly, sameSite=lax', async () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    mockCreateAuthorizationURL.mockReturnValue(authUrl)

    const event = createMockEvent()
    await capturedHandler!(event)

    const stateCookie = event.setCookieCalls.find((c) => c.name === 'google_oauth_state')
    expect(stateCookie).toBeDefined()
    expect(stateCookie!.value).toBe('mock-state-value')
    expect(stateCookie!.options.maxAge).toBe(600)
    expect(stateCookie!.options.httpOnly).toBe(true)
    expect(stateCookie!.options.sameSite).toBe('lax')
    expect(stateCookie!.options.path).toBe('/')
  })

  it('sets the google_oauth_code_verifier cookie with maxAge=600, httpOnly, sameSite=lax', async () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    mockCreateAuthorizationURL.mockReturnValue(authUrl)

    const event = createMockEvent()
    await capturedHandler!(event)

    const verifierCookie = event.setCookieCalls.find((c) => c.name === 'google_oauth_code_verifier')
    expect(verifierCookie).toBeDefined()
    expect(verifierCookie!.value).toBe('mock-code-verifier-value')
    expect(verifierCookie!.options.maxAge).toBe(600)
    expect(verifierCookie!.options.httpOnly).toBe(true)
    expect(verifierCookie!.options.sameSite).toBe('lax')
    expect(verifierCookie!.options.path).toBe('/')
  })

  it('redirects to the Google OAuth authorization URL', async () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', 'test-google-client-id')
    mockCreateAuthorizationURL.mockReturnValue(authUrl)

    const event = createMockEvent()
    await capturedHandler!(event)

    expect(event.redirectUrl).toBeTruthy()
    expect(event.redirectUrl).toContain('accounts.google.com')
  })

  it('does not set the secure flag when NODE_ENV is not production', async () => {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    mockCreateAuthorizationURL.mockReturnValue(authUrl)

    const event = createMockEvent()
    await capturedHandler!(event)

    const stateCookie = event.setCookieCalls.find((c) => c.name === 'google_oauth_state')
    // NODE_ENV is 'test' (set in test/setup.ts), so secure should be false
    expect(stateCookie!.options.secure).toBe(false)
  })

  it('generates different state and verifier values on each invocation', async () => {
    const authUrl1 = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    const authUrl2 = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    mockCreateAuthorizationURL.mockReturnValueOnce(authUrl1).mockReturnValueOnce(authUrl2)
    mockGenerateState
      .mockReturnValueOnce('state-first-call')
      .mockReturnValueOnce('state-second-call')
    mockGenerateCodeVerifier
      .mockReturnValueOnce('verifier-first-call')
      .mockReturnValueOnce('verifier-second-call')

    const event1 = createMockEvent()
    const event2 = createMockEvent()
    await capturedHandler!(event1)
    await capturedHandler!(event2)

    const state1 = event1.setCookieCalls.find((c) => c.name === 'google_oauth_state')!.value
    const state2 = event2.setCookieCalls.find((c) => c.name === 'google_oauth_state')!.value
    expect(state1).toBe('state-first-call')
    expect(state2).toBe('state-second-call')
    expect(state1).not.toBe(state2)
  })
})
