import { createHash } from 'crypto'
import { sessions } from '../db/schema'
import type { H3Event } from 'h3'

export async function createNewUserSession(event: H3Event, userId: string) {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const sessionId = Buffer.from(randomBytes).toString('hex')

  const hashedSessionId = createHash('sha256').update(sessionId).digest('hex')

  const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS)

  await db.insert(sessions).values({
    id: hashedSessionId,
    userId: userId,
    expiresAt: expiresAt,
  })

  setCookie(event, 'app_session_id', sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt,
  })

  return { sessionId, expiresAt }
}
