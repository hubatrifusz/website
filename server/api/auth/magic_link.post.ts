import { createHash } from 'crypto'
import { eq } from 'drizzle-orm'
import { users, verificationTokens } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = body?.email?.trim().toLowerCase()

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email address is required.',
    })
  }

  let user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({
        email: email,
        email_verified: false,
      })
      .returning()
    user = newUser
  }

  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const token = Buffer.from(randomBytes).toString('hex')
  const hashedToken = createHash('sha256').update(token).digest('hex')

  const TOKEN_LIFETIME_MS = 1000 * 60 * 15
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS)

  await db.insert(verificationTokens).values({
    hashedToken: hashedToken,
    expiresAt: expiresAt,
    userId: user!.userId,
  })

  //TODO: swap this in production to an env var
  // const magicLink = `http://localhost:3000/api/auth/verify?token=${token}`

  //TODO: email sending goes here

  return {
    success: true,
    message: 'If that email exists in our system, a login link has been sent.',
  }
})
