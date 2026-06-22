import * as arctic from 'arctic'
import { createHash } from 'node:crypto'
import { sessions } from '~~/server/db/schema'
import type { GoogleProfile } from '~~/server/types/auth'
import { findOrCreateGoogleUser } from '~~/server/utils/user'

const clientId = process.env.GOOGLE_CLIENT_ID
if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set.')
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not set.')
const redirectURI = process.env.REDIRECT_URI
if (!redirectURI) throw new Error('REDIRECT_URI is not set.')

const google = new arctic.Google(clientId, clientSecret, redirectURI)

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code?.toString()
  const state = query.state?.toString()

  const storedState = getCookie(event, 'google_oauth_state')
  const storedCodeVerifier = getCookie(event, 'google_oauth_code_verifier')

  deleteCookie(event, 'google_oauth_state')
  deleteCookie(event, 'google_oauth_code_verifier')

  if (query.error) {
    return sendRedirect(event, '/login?error=access_denied')
  }

  if (!code || !storedState || state !== storedState || !storedCodeVerifier) {
    throw createError({
      status: 400,
      statusMessage: 'Security check failed: State mismatch or missing parameters.',
    })
  }

  try {
    const tokens = await google.validateAuthorizationCode(code!, storedCodeVerifier!)
    const idToken = tokens.idToken()

    const googleUser = arctic.decodeIdToken(idToken) as GoogleProfile
    if (!googleUser.email_verified) {
      throw createError({
        status: 401,
        statusMessage: 'Email not verified by Google.',
      })
    }

    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : undefined

    const user = await findOrCreateGoogleUser(googleUser, refreshToken)

    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const sessionId = Buffer.from(randomBytes).toString('hex')
    const hashedSessionId = createHash('sha256').update(sessionId).digest('hex')

    const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30
    const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS)

    await db.insert(sessions).values({
      id: hashedSessionId,
      userId: user!.userId,
      expiresAt: expiresAt,
    })

    setCookie(event, 'app_session_id', sessionId, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
    })

    return sendRedirect(event, '/')
  } catch (error) {
    if (error instanceof H3Error) {
      throw error
    }
    if (error instanceof arctic.OAuth2RequestError) {
      throw createError({
        status: 400,
        statusMessage: 'Google rejected the authorization code.',
      })
    }
    if (error instanceof arctic.ArcticFetchError) {
      throw createError({
        status: 400,
        statusMessage: 'Failed to fetch authentication.',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal authentication handshake failed.',
    })
  }
})
