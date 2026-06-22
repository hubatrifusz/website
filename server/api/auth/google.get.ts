import * as arctic from 'arctic'

const clientId = process.env.GOOGLE_CLIENT_ID
if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not set.')
const clientSecret = process.env.GOOGLE_CLIENT_SECRET
if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET is not set.')
const redirectURI = process.env.REDIRECT_URI
if (!redirectURI) throw new Error('REDIRECT_URI is not set.')

const google = new arctic.Google(clientId, clientSecret, redirectURI)

export default defineEventHandler(async (event) => {
  const state = arctic.generateState()
  const codeVerifier = arctic.generateCodeVerifier()
  const scopes = ['openid', 'profile', 'email']

  const url = google.createAuthorizationURL(state, codeVerifier, scopes)
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')

  setCookie(event, 'google_oauth_state', state, {
    path: '/',
    maxAge: 60 * 10,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
  setCookie(event, 'google_oauth_code_verifier', codeVerifier, {
    path: '/',
    maxAge: 60 * 10,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  return sendRedirect(event, url.toString())
})
