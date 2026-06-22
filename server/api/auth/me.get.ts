import { sessions, users } from '~~/server/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { createHash } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, 'app_session_id')
  if (!sessionId) return { user: null }
  const hashedSessionId = createHash('sha256').update(sessionId).digest('hex')

  const [user] = await db
    .select({
      userId: users.userId,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.userId))
    .where(and(eq(sessions.id, hashedSessionId), gt(sessions.expiresAt, new Date())))
    .limit(1)

  if (!user) {
    deleteCookie(event, 'app_session_id')
    return { user: null }
  }

  return { user: user }
})
