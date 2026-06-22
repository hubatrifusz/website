import { describe, it, expect } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

// ---------------------------------------------------------------------------
// E2E tests boot the actual Nuxt/Nitro server via @nuxt/test-utils. The server
// runs in a subprocess and uses the bundled (Rollup/Nitro) output where
// vi.mock() calls in the test file have no effect. These tests therefore focus
// on:
//   1. Routes that do NOT touch the database (google redirect, error paths).
//   2. Routes where the expected behavior is deterministic even without a live
//      DB (no-cookie fast-paths for /me and /logout).
//   3. State-validation failures in the callback route.
//
// Routes that require a live database (happy-path callback, valid session /me)
// are integration-tested at the unit level; they would require a real Postgres
// instance to be available in CI.
// ---------------------------------------------------------------------------

await setup({
  rootDir: 'c:/Users/hubat/Desktop/Work/Business/website',
  server: true,
  browser: false,
})

describe('E2E Auth Flow', () => {
  // -------------------------------------------------------------------------
  // GET /api/auth/google  — Login Initiation
  // -------------------------------------------------------------------------
  describe('GET /api/auth/google (Login Initiation)', () => {
    it('responds with a redirect to the Google OAuth authorization endpoint', async () => {
      let locationHeader: string | null = null
      let statusCode: number | null = null

      await $fetch('/api/auth/google', {
        method: 'GET',
        redirect: 'manual',
        ignoreResponseError: true,
        onResponse({ response }) {
          statusCode = response.status
          locationHeader = response.headers.get('location')
        },
      })

      // Must redirect (3xx) to Google's authorization endpoint
      expect(statusCode).toBeGreaterThanOrEqual(300)
      expect(statusCode).toBeLessThan(400)
      expect(locationHeader).toBeTruthy()
      expect(locationHeader).toContain('accounts.google.com')
    })

    it('sets a google_oauth_state cookie that is HttpOnly', async () => {
      let setCookieHeader: string[] = []

      await $fetch('/api/auth/google', {
        method: 'GET',
        redirect: 'manual',
        ignoreResponseError: true,
        onResponse({ response }) {
          setCookieHeader = response.headers.getSetCookie?.() ?? []
        },
      })

      const stateCookie = setCookieHeader.find((c) =>
        c.toLowerCase().startsWith('google_oauth_state='),
      )
      expect(stateCookie).toBeDefined()
      expect(stateCookie!.toLowerCase()).toContain('httponly')
    })

    it('sets a google_oauth_code_verifier cookie that is HttpOnly', async () => {
      let setCookieHeader: string[] = []

      await $fetch('/api/auth/google', {
        method: 'GET',
        redirect: 'manual',
        ignoreResponseError: true,
        onResponse({ response }) {
          setCookieHeader = response.headers.getSetCookie?.() ?? []
        },
      })

      const verifierCookie = setCookieHeader.find((c) =>
        c.toLowerCase().startsWith('google_oauth_code_verifier='),
      )
      expect(verifierCookie).toBeDefined()
      expect(verifierCookie!.toLowerCase()).toContain('httponly')
    })

    it('sets the google_oauth_state cookie with maxAge of 600 seconds', async () => {
      let setCookieHeader: string[] = []

      await $fetch('/api/auth/google', {
        method: 'GET',
        redirect: 'manual',
        ignoreResponseError: true,
        onResponse({ response }) {
          setCookieHeader = response.headers.getSetCookie?.() ?? []
        },
      })

      const stateCookie = setCookieHeader.find((c) =>
        c.toLowerCase().startsWith('google_oauth_state='),
      )
      expect(stateCookie).toBeDefined()
      expect(stateCookie!.toLowerCase()).toContain('max-age=600')
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/auth/callback  — OAuth Callback failure paths
  // -------------------------------------------------------------------------
  describe('GET /api/auth/callback (OAuth Callback)', () => {
    it('redirects to /login?error=access_denied when query.error is set', async () => {
      let locationHeader: string | null = null
      let statusCode: number | null = null

      await $fetch('/api/auth/callback?error=access_denied&state=any', {
        method: 'GET',
        redirect: 'manual',
        ignoreResponseError: true,
        onResponse({ response }) {
          statusCode = response.status
          locationHeader = response.headers.get('location')
        },
      })

      expect(statusCode).toBeGreaterThanOrEqual(300)
      expect(statusCode).toBeLessThan(400)
      expect(locationHeader).toContain('/login?error=access_denied')
    })

    it('returns 400 when no code is provided and state does not match stored state', async () => {
      let statusCode: number | null = null

      await $fetch('/api/auth/callback?state=wrong-state', {
        method: 'GET',
        ignoreResponseError: true,
        onResponse({ response }) {
          statusCode = response.status
        },
      })

      expect(statusCode).toBe(400)
    })

    it('returns 400 when both code and state are missing', async () => {
      let statusCode: number | null = null

      await $fetch('/api/auth/callback', {
        method: 'GET',
        ignoreResponseError: true,
        onResponse({ response }) {
          statusCode = response.status
        },
      })

      expect(statusCode).toBe(400)
    })

    it('returns 400 when the stored OAuth state cookie is absent (no CSRF cookie)', async () => {
      // Provide code + state in query but no cookies → state mismatch → 400
      let statusCode: number | null = null

      await $fetch('/api/auth/callback?code=some-code&state=some-state', {
        method: 'GET',
        ignoreResponseError: true,
        onResponse({ response }) {
          statusCode = response.status
        },
      })

      expect(statusCode).toBe(400)
    })
  })

  // -------------------------------------------------------------------------
  // GET /api/auth/me  — Session Resolution
  // -------------------------------------------------------------------------
  describe('GET /api/auth/me (Session Resolution)', () => {
    it('returns { user: null } immediately when no session cookie is present', async () => {
      const data = await $fetch<{ user: null }>('/api/auth/me', {
        method: 'GET',
      })

      expect(data).toEqual({ user: null })
    })
  })

  // -------------------------------------------------------------------------
  // POST /api/auth/logout  — Logout
  // -------------------------------------------------------------------------
  describe('POST /api/auth/logout (Logout Flow)', () => {
    it('returns { success: true } when no session cookie is present', async () => {
      const data = await $fetch<{ success: boolean; message: string }>('/api/auth/logout', {
        method: 'POST',
      })

      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully')
    })
  })
})
