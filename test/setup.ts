// Must set env vars BEFORE any module import resolves, because google.get.ts
// and callback.get.ts read them at module-init time (top-level code).
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.REDIRECT_URI = 'http://localhost:3000/api/auth/callback'
process.env.DATABASE_URL = 'postgres://admin:admin@localhost:5433/testing'
process.env.NODE_ENV = 'test'
