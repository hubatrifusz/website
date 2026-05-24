import bcrypt from 'bcrypt'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { email, firstName, lastName, password } = body

  if (!email || !firstName || !lastName || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fields!' })
  }

  const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)

  if (existingUser.length == 1) {
    throw createError({ statusCode: 400, statusMessage: 'User already exists!' })
  }

  const salt = 12
  const passwordHash = await bcrypt.hash(password, salt)

  // const [newUser] =
  await db
    .insert(users)
    .values({
      email,
      firstName,
      lastName,
      passwordHash,
    })
    .returning()

  // TODO: Auto sign in after registration

  return { success: true, message: 'User created successfully!' }
})
