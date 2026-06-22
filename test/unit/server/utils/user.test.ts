import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findOrCreateGoogleUser } from '../../../../server/utils/user'
import type { GoogleProfile } from '../../../../server/types/auth'

// ---------------------------------------------------------------------------
// Use vi.hoisted() so these mock functions are initialized BEFORE vi.mock()
// factories run (vi.mock is hoisted to the top of the file by Vitest's
// transform, potentially before const declarations in the original source).
// ---------------------------------------------------------------------------
const { mockFindFirst, mockReturning, mockValues, mockInsert } = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockValues = vi.fn(() => ({ returning: mockReturning }))
  const mockInsert = vi.fn(() => ({ values: mockValues }))
  const mockFindFirst = vi.fn()
  return { mockFindFirst, mockReturning, mockValues, mockInsert }
})

vi.mock('~~/server/utils/db', () => ({
  db: {
    query: {
      users: {
        findFirst: mockFindFirst,
      },
    },
    insert: mockInsert,
  },
}))

vi.mock('~~/server/db/schema', () => ({
  users: { googleId: 'google_id_column_ref' },
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
}))

const baseProfile: GoogleProfile = {
  sub: 'google-sub-123',
  email: 'test@example.com',
  name: 'Test User',
  email_verified: true,
}

const existingUser = {
  userId: 'existing-uuid',
  name: 'Test User',
  email: 'test@example.com',
  googleId: 'google-sub-123',
  role: 'user' as const,
  email_verified: true,
  googleRefreshToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const newUser = {
  userId: 'new-uuid',
  name: 'Test User',
  email: 'test@example.com',
  googleId: 'google-sub-123',
  role: 'user' as const,
  email_verified: true,
  googleRefreshToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('findOrCreateGoogleUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore builder chain after clearAllMocks resets call history
    mockValues.mockImplementation(() => ({ returning: mockReturning }))
    mockInsert.mockImplementation(() => ({ values: mockValues }))
  })

  describe('existing user found', () => {
    it('returns the existing user directly without inserting', async () => {
      mockFindFirst.mockResolvedValue(existingUser)

      const result = await findOrCreateGoogleUser(baseProfile)

      expect(result).toEqual(existingUser)
      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('passes a where option based on googleId (sub) to findFirst', async () => {
      mockFindFirst.mockResolvedValue(existingUser)

      await findOrCreateGoogleUser(baseProfile)

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.anything(),
        }),
      )
    })
  })

  describe('new user (no existing record)', () => {
    it('inserts a new user and returns it when findFirst returns undefined', async () => {
      mockFindFirst.mockResolvedValue(undefined)
      mockReturning.mockResolvedValue([newUser])

      const result = await findOrCreateGoogleUser(baseProfile)

      expect(result).toEqual(newUser)
      expect(mockInsert).toHaveBeenCalledOnce()
    })

    it('inserts with correct fields from the GoogleProfile', async () => {
      mockFindFirst.mockResolvedValue(undefined)
      mockReturning.mockResolvedValue([newUser])

      await findOrCreateGoogleUser(baseProfile)

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: baseProfile.name,
          email: baseProfile.email,
          googleId: baseProfile.sub,
          email_verified: baseProfile.email_verified,
        }),
      )
    })

    it('inserts with googleRefreshToken when a refreshToken is provided', async () => {
      mockFindFirst.mockResolvedValue(undefined)
      const userWithToken = { ...newUser, googleRefreshToken: 'rt-token' }
      mockReturning.mockResolvedValue([userWithToken])

      await findOrCreateGoogleUser(baseProfile, 'rt-token')

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          googleRefreshToken: 'rt-token',
        }),
      )
    })

    it('inserts with undefined googleRefreshToken when no refreshToken is passed', async () => {
      mockFindFirst.mockResolvedValue(undefined)
      mockReturning.mockResolvedValue([newUser])

      await findOrCreateGoogleUser(baseProfile)

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          googleRefreshToken: undefined,
        }),
      )
    })

    it('calls .returning() so the new user record is retrieved from the DB', async () => {
      mockFindFirst.mockResolvedValue(undefined)
      mockReturning.mockResolvedValue([newUser])

      await findOrCreateGoogleUser(baseProfile)

      expect(mockReturning).toHaveBeenCalledOnce()
    })
  })
})
