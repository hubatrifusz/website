import { createHash } from 'crypto'
import { and, eq, gt } from 'drizzle-orm'
import { users, verificationTokens } from '~~/server/db/schema'
import { createNewUserSession } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  if (!query.token) {
    throw createError({
      status: 400,
      statusMessage: 'No token found in the request URL.',
    })
  }

  const token = query.token!.toString()

  const hashedToken = createHash('sha256').update(token).digest('hex')

  const storedToken = await db.query.verificationTokens.findFirst({
    where: and(
      eq(verificationTokens.hashedToken, hashedToken),
      gt(verificationTokens.expiresAt, new Date()),
    ),
  })

  if (!storedToken) {
    throw createError({
      status: 400,
      statusMessage: 'Your login link is invalid or has expired.',
    })
  }

  await db.delete(verificationTokens).where(eq(verificationTokens.hashedToken, hashedToken))
  await db
    .update(users)
    .set({
      email_verified: true,
    })
    .where(eq(users.userId, storedToken.userId))

  await createNewUserSession(event, storedToken.userId)

  return sendRedirect(event, '/')
})
