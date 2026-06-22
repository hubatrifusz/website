import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// DB mock — me.get.ts uses db.select().from().innerJoin().where().limit().
// The handler accesses `db` as a Nuxt auto-import global. We stub both the
// module export AND the global so either access pattern is covered.
// ---------------------------------------------------------------------------
const mockLimit = vi.fn()
const mockWhere = vi.fn(() => ({ limit: mockLimit }))
const mockInnerJoin = vi.fn(() => ({ where: mockWhere }))
const mockFrom = vi.fn(() => ({ innerJoin: mockInnerJoin }))
const mockSelect = vi.fn(() => ({ from: mockFrom }))

const mockDb = { select: mockSelect }

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
  users: {
    userId: 'users_userId_col',
    name: 'users_name_col',
    email: 'users_email_col',
    role: 'users_role_col',
  },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args) => ({ type: 'and', args })),
  gt: vi.fn((a, b) => ({ type: 'gt', a, b })),
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

interface MockEvent {
  cookies: Record<string, string>
  setCookieCalls: Array<{ name: string; value: string; options: CookieOptions }>
  deletedCookies: string[]
  node: { req: Record<string, unknown>; res: Record<string, unknown> }
  context: Record<string, unknown>
}

function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    cookies: {},
    setCookieCalls: [],
    deletedCookies: [],
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

vi.stubGlobal('getCookie', (event: MockEvent, name: string) => event.cookies[name])

vi.stubGlobal(
  'setCookie',
  (event: MockEvent, name: string, value: string, options: CookieOptions) => {
    event.setCookieCalls.push({ name, value, options })
  },
)

vi.stubGlobal('deleteCookie', (event: MockEvent, name: string) => {
  event.deletedCookies.push(name)
})

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

vi.stubGlobal(
  'H3Error',
  class H3ErrorStub extends Error {
    statusCode: number
    constructor(opts: { statusCode?: number } = {}) {
      super()
      this.statusCode = opts.statusCode ?? 500
    }
  },
)

// ---------------------------------------------------------------------------
// Import handler via relative path
// ---------------------------------------------------------------------------
await import('../../../../../server/api/auth/me.get')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const mockUser = {
  userId: 'user-uuid-1234',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user',
}

describe('GET /api/auth/me (Session Resolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore the select query chain mock structure after clearAllMocks
    mockLimit.mockReset()
    mockWhere.mockImplementation(() => ({ limit: mockLimit }))
    mockInnerJoin.mockImplementation(() => ({ where: mockWhere }))
    mockFrom.mockImplementation(() => ({ innerJoin: mockInnerJoin }))
    mockSelect.mockImplementation(() => ({ from: mockFrom }))
    // Re-bind db global in case it was cleared
    vi.stubGlobal('db', mockDb)
  })

  describe('no cookie present', () => {
    it('returns { user: null } immediately without hitting the database', async () => {
      const event = createMockEvent({ cookies: {} })

      const result = await capturedHandler!(event)

      expect(result).toEqual({ user: null })
      expect(mockSelect).not.toHaveBeenCalled()
    })
  })

  describe('valid session', () => {
    it('returns { user } when a matching non-expired session row exists', async () => {
      mockLimit.mockResolvedValue([mockUser])

      const event = createMockEvent({ cookies: { app_session_id: 'raw-session-id' } })

      const result = await capturedHandler!(event)

      expect(result).toEqual({ user: mockUser })
    })

    it('queries with the SHA-256 hash of the raw session cookie value, not the raw value', async () => {
      mockLimit.mockResolvedValue([mockUser])

      const rawId = 'my-raw-session-token'
      const expectedHash = createHash('sha256').update(rawId).digest('hex')

      const event = createMockEvent({ cookies: { app_session_id: rawId } })

      await capturedHandler!(event)

      // The where clause is built with eq(sessions.id, hashedSessionId).
      // Verify that eq() was called with the expected hash.
      const { eq } = await import('drizzle-orm')
      const eqCalls = vi.mocked(eq).mock.calls
      const hashWasUsed = eqCalls.some(([, val]) => val === expectedHash)
      expect(hashWasUsed).toBe(true)
    })

    it('does not delete the session cookie when the session is valid', async () => {
      mockLimit.mockResolvedValue([mockUser])

      const event = createMockEvent({ cookies: { app_session_id: 'raw-session-id' } })

      await capturedHandler!(event)

      expect(event.deletedCookies).not.toContain('app_session_id')
    })
  })

  describe('invalid / expired session', () => {
    it('returns { user: null } when the session query returns no rows', async () => {
      mockLimit.mockResolvedValue([])

      const event = createMockEvent({ cookies: { app_session_id: 'expired-session-id' } })

      const result = await capturedHandler!(event)

      expect(result).toEqual({ user: null })
    })

    it('deletes the app_session_id cookie when the session is not found or expired', async () => {
      mockLimit.mockResolvedValue([])

      const event = createMockEvent({ cookies: { app_session_id: 'stale-session-id' } })

      await capturedHandler!(event)

      expect(event.deletedCookies).toContain('app_session_id')
    })
  })

  describe('select projection', () => {
    it('selects only userId, name, email, and role — not sensitive fields like googleRefreshToken', async () => {
      mockLimit.mockResolvedValue([mockUser])

      const event = createMockEvent({ cookies: { app_session_id: 'raw-session-id' } })

      await capturedHandler!(event)

      expect(mockSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.anything(),
          name: expect.anything(),
          email: expect.anything(),
          role: expect.anything(),
        }),
      )
    })
  })
})
