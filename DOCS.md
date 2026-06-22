# Project Documentation

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Getting Started](#2-getting-started)
3. [Database](#3-database)
4. [Architecture and Auth Flow](#4-architecture-and-auth-flow)
5. [Testing](#5-testing)

---

## 1. Tech Stack Overview

This is a full-stack web application built on **Nuxt 4**, using its unified file-based routing to serve both the Vue frontend and a Nitro-powered API backend from a single project. Authentication is handled entirely through **Google OAuth 2.0** via the Arctic library — there are no password-based accounts. The server layer connects directly to a **PostgreSQL** database via **Drizzle ORM**, keeping database access type-safe and migration-driven without a separate backend service.

### Technology Stack

| Layer                | Technology                | Version             |
| -------------------- | ------------------------- | ------------------- |
| Frontend / SSR       | Nuxt 4                    | `^4.4.5`            |
| UI Component Library | Nuxt UI + Tailwind CSS v4 | `^4.7.1`            |
| Server Engine        | Nitro (bundled with Nuxt) | —                   |
| Database             | PostgreSQL                | `16` (Alpine)       |
| ORM                  | Drizzle ORM               | `^0.45.2`           |
| PostgreSQL Driver    | `pg` (node-postgres)      | `^8.21.0`           |
| OAuth 2.0            | Arctic                    | `^3.7.0`            |
| Testing              | Vitest + @nuxt/test-utils | `^4.1.6` / `^4.0.3` |
| Language             | TypeScript                | `^6.0.3`            |
| Linting              | ESLint (@nuxt/eslint)     | `1.15.2`            |
| Formatting           | Prettier                  | `3.8.3`             |
| Git Hooks            | Husky                     | `^9.1.7`            |

---

## 2. Getting Started

### Prerequisites

- **Node.js** v20+ (LTS recommended)
- **pnpm** v9+
- **Docker** and **Docker Compose** (for local databases)
- A **Google Cloud project** with an OAuth 2.0 client configured

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

The project uses two environment files — one for local development and one for the test suite.

**`.env` — development server:**

```env
DATABASE_URL="postgres://admin:admin@localhost:5432/development"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
REDIRECT_URI="http://localhost:3000/api/auth/callback"
```

**`.env.test` — test suite:**

```env
DATABASE_URL="postgres://admin:admin@localhost:5433/testing"
```

The `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `REDIRECT_URI` values for the test suite are injected programmatically by `test/setup.ts` before any module loads, so they do not need to appear in `.env.test`.

> Never point the test suite at the development database. The two databases run on different ports (`5432` and `5433`) to enforce complete isolation.

### 3. Start the Databases

Use Docker Compose to spin up both PostgreSQL instances:

```bash
docker compose up -d
```

This starts two containers:

| Container       | Port   | Database      | Used by     |
| --------------- | ------ | ------------- | ----------- |
| `postgres_dev`  | `5432` | `development` | `pnpm dev`  |
| `postgres_test` | `5433` | `testing`     | `pnpm test` |

### 4. Run Database Migrations

Apply the Drizzle schema to the development database:

```bash
pnpm drizzle-kit migrate
```

To migrate the test database, pass the test environment file explicitly:

```bash
dotenv -e .env.test -- pnpm drizzle-kit migrate
```

### 5. Start the Development Server

```bash
pnpm dev
```

The application is available at `http://localhost:3000`.

---

## 3. Database

### Drizzle ORM Integration

Drizzle ORM is initialised once as a server-side singleton in `server/utils/db.ts`. Nitro auto-imports everything from `server/utils/`, so the exported `db` instance is available in every API route handler without an explicit import statement.

```ts
// server/utils/db.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../db/schema'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })
```

The connection string is read from `process.env.DATABASE_URL` at startup. Switching between environments is entirely controlled by which `.env` file is active.

### Schema

All table definitions live in `server/db/schema.ts` and are consumed by both the runtime (`db`) and Drizzle Kit (for migrations via `drizzle.config.ts`). Migrations are generated into the `./drizzle` directory.

#### `users` Table

| Column               | DB Column              | Type          | Constraints                                   |
| -------------------- | ---------------------- | ------------- | --------------------------------------------- |
| `userId`             | `user_id`              | `uuid`        | Primary key, `DEFAULT gen_random_uuid()`      |
| `name`               | `name`                 | `text`        | Nullable                                      |
| `email`              | `email`                | `text`        | `UNIQUE`, `NOT NULL`                          |
| `role`               | `role`                 | `text`        | `NOT NULL`, `DEFAULT 'user'`                  |
| `googleId`           | `google_id`            | `text`        | `UNIQUE`, nullable                            |
| `googleRefreshToken` | `google_refresh_token` | `text`        | Nullable                                      |
| `email_verified`     | `email_verified`       | `boolean`     | `NOT NULL`, `DEFAULT false`                   |
| `createdAt`          | `created_at`           | `timestamptz` | `NOT NULL`, `DEFAULT NOW()`                   |
| `updatedAt`          | `updated_at`           | `timestamptz` | `NOT NULL`, `DEFAULT NOW()`, updated on write |

#### `sessions` Table

| Column      | DB Column    | Type          | Constraints                                                    |
| ----------- | ------------ | ------------- | -------------------------------------------------------------- |
| `id`        | `id`         | `text`        | Primary key (stores the SHA-256 hash of the raw session token) |
| `userId`    | `user_id`    | `uuid`        | `NOT NULL`, FK → `users.user_id` (`ON DELETE CASCADE`)         |
| `expiresAt` | `expires_at` | `timestamptz` | `NOT NULL`                                                     |
| `createdAt` | `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT NOW()`                                    |

Deleting a user automatically cascades to delete all of that user's sessions.

### Drizzle Kit Configuration

`drizzle.config.ts` points Drizzle Kit at the schema file and the target database. It uses `dotenv/config` to load `DATABASE_URL` from the active `.env` file before the config is evaluated.

```ts
// drizzle.config.ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './server/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

---

## 4. Architecture and Auth Flow

Authentication is implemented entirely using Google OAuth 2.0 with PKCE (Proof Key for Code Exchange), managed by the [Arctic](https://arcticjs.dev/) library. There are no password-based accounts. The four server routes that make up the auth system are described below.

### Route Reference

#### `GET /api/auth/google` — Login Initiation

**Source:** `server/api/auth/google.get.ts`

Generates a fresh OAuth state value and PKCE code verifier using Arctic, builds the Google authorization URL with scopes `openid`, `profile`, and `email`, appends `access_type=offline` and `prompt=consent` to request a refresh token, and stores the state and code verifier in short-lived (10-minute) HttpOnly cookies before redirecting the browser to Google.

**Cookies set:**

| Cookie                       | Value         | MaxAge | Flags                  |
| ---------------------------- | ------------- | ------ | ---------------------- |
| `google_oauth_state`         | Random state  | 600 s  | HttpOnly, SameSite=Lax |
| `google_oauth_code_verifier` | PKCE verifier | 600 s  | HttpOnly, SameSite=Lax |

**Response:** `302` redirect to `https://accounts.google.com/o/oauth2/v2/auth`

---

#### `GET /api/auth/callback` — OAuth Callback

**Source:** `server/api/auth/callback.get.ts`

Handles the redirect back from Google after the user authenticates. The handler immediately deletes both OAuth cookies, then performs several security checks before proceeding.

**Security checks (in order):**

1. If `query.error` is present, redirects to `/login?error=access_denied` without processing.
2. Validates that `code`, `state`, stored state cookie, and stored code verifier are all present and that `state` matches the stored cookie value. Throws `400` on any mismatch.

**On success:**

1. Calls `google.validateAuthorizationCode(code, codeVerifier)` to exchange the authorization code for tokens.
2. Decodes the ID token and rejects the request with `401` if `email_verified` is `false`.
3. Calls `findOrCreateGoogleUser()` to look up or create the user record in the database, passing the refresh token if one was issued.
4. Generates a cryptographically secure session token: 32 random bytes from `crypto.getRandomValues()`, hex-encoded.
5. Hashes the raw token with SHA-256 and stores only the hash in the `sessions` table. The raw token is never persisted.
6. Sets the `app_session_id` cookie with the raw (unhashed) token as an HttpOnly, SameSite=Lax cookie with a 30-day expiry.
7. Redirects to `/`.

**Error responses:**

| Condition                       | Status                               |
| ------------------------------- | ------------------------------------ |
| `query.error` present           | `302` → `/login?error=access_denied` |
| State mismatch / missing params | `400`                                |
| `email_verified: false`         | `401`                                |
| Google rejects the auth code    | `400`                                |
| Network failure reaching Google | `400`                                |
| Unexpected error                | `500`                                |

---

#### `GET /api/auth/me` — Session Resolution

**Source:** `server/api/auth/me.get.ts`

Reads the `app_session_id` cookie, hashes the value with SHA-256, and performs a single database query joining `sessions` and `users` filtered by the hashed ID and an expiry check (`expiresAt > now()`).

Returns `{ user: null }` immediately if the cookie is absent. Deletes the cookie and returns `{ user: null }` if the session is not found or has expired. Returns `{ user }` on a valid session, exposing only `userId`, `name`, `email`, and `role` — sensitive fields such as `googleRefreshToken` are never returned.

**Response shape (authenticated):**

```json
{
  "user": {
    "userId": "...",
    "name": "...",
    "email": "...",
    "role": "user"
  }
}
```

**Response shape (unauthenticated):**

```json
{ "user": null }
```

---

#### `POST /api/auth/logout` — Logout

**Source:** `server/api/auth/logout.post.ts`

Reads the `app_session_id` cookie, hashes it with SHA-256, and deletes the matching row from the `sessions` table. Then deletes the cookie from the browser response. If no cookie is present, it is a no-op. Always returns `{ success: true, message: "Logged out successfully" }`.

---

### Server Utilities

#### `findOrCreateGoogleUser` — `server/utils/user.ts`

Called by the callback handler after a successful token exchange. Looks up an existing user by `google_id`. If found, returns the existing record. If not found, inserts a new row and returns it via `.returning()`. Accepts an optional `refreshToken` string which is stored in `google_refresh_token` when provided.

#### `GoogleProfile` type — `server/types/auth.ts`

```ts
export interface GoogleProfile {
  sub: string
  email: string
  name?: string
  email_verified: boolean
}
```

This is the shape of the decoded Google ID token as returned by `arctic.decodeIdToken()`.

---

## 5. Testing

### Overview

The test suite uses **Vitest** as the test runner. Tests are split into two categories — unit tests and E2E tests — each targeting different layers of the stack.

```
test/
├── setup.ts                              # Global env var injection (runs before all tests)
├── tsconfig.json                         # Extends .nuxt/tsconfig.server.json
├── unit/
│   └── server/
│       ├── api/auth/
│       │   ├── google.get.test.ts
│       │   ├── callback.get.test.ts
│       │   ├── me.get.test.ts
│       │   └── logout.post.test.ts
│       └── utils/
│           └── user.test.ts
└── e2e/
    └── server/api/auth/
        └── auth.flow.test.ts
```

### Running Tests

```bash
# Run all tests once
pnpm test

# Run in watch mode
pnpm vitest

# Open the Vitest UI
pnpm vitest --ui
```

### Environment Setup — `test/setup.ts`

The `test/setup.ts` file is loaded before any test module is imported. It sets environment variables directly onto `process.env` to satisfy the module-level checks in the auth route handlers, which read `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `REDIRECT_URI` at import time (top-level code outside `defineEventHandler`).

```ts
// test/setup.ts
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.REDIRECT_URI = 'http://localhost:3000/api/auth/callback'
process.env.DATABASE_URL = 'postgres://admin:admin@localhost:5433/testing'
process.env.NODE_ENV = 'test'
```

The `vite.config.ts` at the project root provides `~~` and `@@` path alias resolution for unit tests running in the `node` environment outside the Nuxt runtime.

### Unit Tests — Mocking Strategy

Unit tests import route handlers directly using relative paths (bypassing the `~~` alias shim) and use `vi.mock()` and `vi.stubGlobal()` to replace all external dependencies. This approach is necessary because Nuxt's H3 helpers (`defineEventHandler`, `getCookie`, `setCookie`, `deleteCookie`, `sendRedirect`, `getQuery`, `createError`, `H3Error`) are auto-injected by the Nitro runtime and do not exist in a plain Node test environment.

**Pattern applied consistently across all unit tests:**

1. `vi.mock('arctic', ...)` — replaces the Arctic library with a factory that returns mock functions for `Google`, `generateState`, `generateCodeVerifier`, `decodeIdToken`, `OAuth2RequestError`, and `ArcticFetchError`.
2. `vi.mock('~~/server/utils/db', ...)` and `vi.stubGlobal('db', mockDb)` — stubs the Drizzle `db` instance at both the module level and as a Nuxt global. Both are needed because different import patterns may resolve to either.
3. `vi.mock('~~/server/db/schema', ...)` — provides plain-object column references so Drizzle query builders can run without a real database.
4. `vi.mock('drizzle-orm', ...)` — replaces `eq`, `and`, and `gt` with lightweight stubs that return serializable objects, making it straightforward to assert which conditions were passed to a query.
5. `vi.stubGlobal('defineEventHandler', fn => { capturedHandler = fn; return fn })` — intercepts the handler registration so tests can invoke the handler function directly with a controlled mock event object.
6. Mock event objects (`createMockEvent`) carry `cookies`, `setCookieCalls`, `deletedCookies`, and `redirectUrl` fields that tests assert against after invoking the captured handler.

Because `vi.mock()` calls are hoisted to the top of the file by Vitest's transform, all mock factories are guaranteed to run before the handler module is imported.

### E2E Tests — `test/e2e/server/api/auth/auth.flow.test.ts`

E2E tests use `@nuxt/test-utils/e2e` to boot the actual Nuxt/Nitro server in a subprocess and send real HTTP requests via `$fetch`. Because the server runs as a compiled Nitro bundle, `vi.mock()` calls in the test file have no effect on it.

The E2E suite therefore targets only routes and code paths that are deterministic without a live database connection:

- `GET /api/auth/google` — verifies the redirect to `accounts.google.com` and the presence of HttpOnly state/verifier cookies.
- `GET /api/auth/callback` — covers error and state-mismatch failure paths that return `400` or redirect to `/login?error=access_denied` before any database interaction occurs.
- `GET /api/auth/me` — verifies the `{ user: null }` fast-path when no session cookie is present.
- `POST /api/auth/logout` — verifies the `{ success: true }` response when no session cookie is present.

Happy-path scenarios that require a live database (valid callback exchange, authenticated `/me` response) are covered at the unit test level instead.

> The postgres test database container must be running before E2E tests execute, as `@nuxt/test-utils` boots a full Nuxt server which imports `server/utils/db.ts` and opens a connection pool on startup.
