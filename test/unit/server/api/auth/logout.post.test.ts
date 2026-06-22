import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// DB mock — logout.post.ts uses db.delete(sessions).where(...).
// The handler uses `db` as a Nuxt auto-import global, so we stub both the
// module AND the global.
// ---------------------------------------------------------------------------
const mockWhere = vi.fn().mockResolvedValue(undefined)
const mockDelete = vi.fn(() => ({ where: mockWhere }))
const mockDb = { delete: mockDelete }

vi.mock('~~/server/utils/db', () => ({
  db: mockDb,
}))

vi.stubGlobal('db', mockDb)

vi.mock('~~/server/db/schema', () => ({
  sessions: { id: 'sessions_id_col' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
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
await import('../../../../../server/api/auth/logout.post')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('POST /api/auth/logout (Logout Flow)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWhere.mockResolvedValue(undefined)
    mockDelete.mockImplementation(() => ({ where: mockWhere }))
    // Re-bind db global
    vi.stubGlobal('db', mockDb)
  })

  describe('with a valid app_session_id cookie', () => {
    it('returns { success: true, message: "Logged out successfully" }', async () => {
      const event = createMockEvent({ cookies: { app_session_id: 'raw-session-token' } })

      const result = await capturedHandler!(event)

      expect(result).toEqual({ success: true, message: 'Logged out successfully' })
    })

    it('calls db.delete on the sessions table', async () => {
      const event = createMockEvent({ cookies: { app_session_id: 'raw-session-token' } })

      await capturedHandler!(event)

      expect(mockDelete).toHaveBeenCalledOnce()
    })

    it('deletes the session from the DB using the SHA-256 hash of the raw cookie value', async () => {
      const rawId = 'raw-session-token'
      const expectedHash = createHash('sha256').update(rawId).digest('hex')

      const event = createMockEvent({ cookies: { app_session_id: rawId } })

      await capturedHandler!(event)

      // Verify eq() was called with the expected SHA-256 hash
      const { eq } = await import('drizzle-orm')
      const eqCalls = vi.mocked(eq).mock.calls
      const hashWasUsed = eqCalls.some(([, val]) => val === expectedHash)
      expect(hashWasUsed).toBe(true)
    })

    it('calls db.delete().where() with the hash-based condition', async () => {
      const event = createMockEvent({ cookies: { app_session_id: 'raw-session-token' } })

      await capturedHandler!(event)

      expect(mockWhere).toHaveBeenCalledOnce()
    })

    it('deletes the app_session_id cookie from the response', async () => {
      const event = createMockEvent({ cookies: { app_session_id: 'raw-session-token' } })

      await capturedHandler!(event)

      expect(event.deletedCookies).toContain('app_session_id')
    })
  })

  describe('without an app_session_id cookie', () => {
    it('returns { success: true, message: "Logged out successfully" }', async () => {
      const event = createMockEvent({ cookies: {} })

      const result = await capturedHandler!(event)

      expect(result).toEqual({ success: true, message: 'Logged out successfully' })
    })

    it('does NOT call db.delete when there is no session cookie', async () => {
      const event = createMockEvent({ cookies: {} })

      await capturedHandler!(event)

      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('does NOT delete the app_session_id cookie when it was absent', async () => {
      const event = createMockEvent({ cookies: {} })

      await capturedHandler!(event)

      expect(event.deletedCookies).not.toContain('app_session_id')
    })
  })
})
