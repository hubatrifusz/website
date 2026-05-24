import { beforeEach, describe, test, expect } from 'vitest'
import { db } from '../../../../../server/utils/db'
import { setup, $fetch } from '@nuxt/test-utils/e2e'
import { eq, sql } from 'drizzle-orm'
import { users } from '../../../../../server/db/schema'

interface RegisterErrorResponse {
  statusCode: number
  statusMessage: string
  message: string
}

interface RegisterSuccessResponse {
  success: boolean
  message: string
}

describe('register endpoint', async () => {
  await setup({
    server: true,
  })

  beforeEach(async () => {
    await db.delete(users)
  })

  const apiRoute = '/api/auth/register'

  test('database connection', async () => {
    const result = await db.execute(sql`SELECT 1 as ping`)

    expect(result).toBeDefined()
    expect(result.rows[0].ping).toBe(1)
  })

  test('missing all fields', async () => {
    const payload = {}

    const response = await $fetch<RegisterErrorResponse>(apiRoute, {
      method: 'POST',
      body: payload,
      ignoreResponseError: true,
    })

    expect(response.statusCode).toEqual(400)
    expect(response.statusMessage).toEqual('Missing fields!')
  })

  test('existing user', async () => {
    const userPayload = {
      email: 'testemail@email.com',
      firstName: 'Alex',
      lastName: 'Jones',
      password: 'securepass123',
    }

    await $fetch(apiRoute, {
      method: 'POST',
      body: userPayload,
    })

    const response = await $fetch<RegisterErrorResponse>(apiRoute, {
      method: 'POST',
      body: userPayload,
      ignoreResponseError: true,
    })

    expect(response.statusCode).toEqual(400)
    expect(response.statusMessage).toEqual('User already exists!')
  })

  test('happy path', async () => {
    const userPayload = {
      email: 'testemail@email.com',
      firstName: 'Alex',
      lastName: 'Jones',
      password: 'securepass123',
    }

    const response = await $fetch<RegisterSuccessResponse>(apiRoute, {
      method: 'POST',
      body: userPayload,
      ignoreResponseError: true,
    })

    expect(response.success).toEqual(true)

    const queryResult = await db.select().from(users).where(eq(users.email, userPayload.email))

    expect(queryResult).toHaveLength(1)
  })

  test('password hashing', async () => {
    const userPayload = {
      email: 'testemail@email.com',
      firstName: 'Alex',
      lastName: 'Jones',
      password: 'securepass123',
    }

    await $fetch(apiRoute, {
      method: 'POST',
      body: userPayload,
    })

    const queryResult = await db.select().from(users).where(eq(users.email, userPayload.email))

    expect(queryResult[0].passwordHash).not.toEqual(userPayload.password)
  })
})
