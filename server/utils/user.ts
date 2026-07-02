import { db } from '~~/server/utils/db'
import { users } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'
import type { GoogleProfile } from '../types/auth'

export async function findOrCreateGoogleUser(googleUser: GoogleProfile, refreshToken?: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, googleUser.email),
  })

  if (user) {
    const [updatedUser] = await db
      .update(users)
      .set({
        name: googleUser.name || user.name,
        googleId: user.googleId || googleUser.sub,
        email_verified: googleUser.email_verified,
        ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
      })
      .where(eq(users.email, googleUser.email))
      .returning()

    return updatedUser
  }

  const [newUser] = await db
    .insert(users)
    .values({
      name: googleUser.name,
      email: googleUser.email,
      googleId: googleUser.sub,
      email_verified: googleUser.email_verified,
      googleRefreshToken: refreshToken,
    })
    .returning()

  return newUser
}
