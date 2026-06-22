import { sessions } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, 'app_session_id')
  if (sessionId) {
    const hashedSessionId = createHash('sha256').update(sessionId).digest('hex')

    await db.delete(sessions).where(eq(sessions.id, hashedSessionId))
    deleteCookie(event, 'app_session_id')
  }

  return { success: true, message: 'Logged out successfully' }
})
