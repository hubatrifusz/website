import { pgTable, uuid, timestamp, text, boolean } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').unique().notNull(),
  role: text('role').default('user').notNull(),
  googleId: text('google_id').unique(),
  googleRefreshToken: text('google_refresh_token'),
  email_verified: boolean().notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const verificationTokens = pgTable('verification_tokens', {
  hashedToken: text('hashed_token').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  userId: uuid('user_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
})
