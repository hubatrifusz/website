import * as arctic from 'arctic'
import type { GoogleProfile } from '~~/server/types/auth'
import { createNewUserSession } from '~~/server/utils/session'
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
    //TODO: find a proper way to display the error, this only surfaces, when the user denies the Google sync
    return sendRedirect(event, '/')
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

    await createNewUserSession(event, user!.userId)

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
