# Project Documentation

## Table of Contents

1. [Project Overview & Tech Stack](#1-project-overview--tech-stack)
2. [Getting Started / Installation](#2-getting-started--installation)
3. [Database Architecture](#3-database-architecture)
4. [API Endpoint Reference](#4-api-endpoint-reference)
5. [Testing Strategy](#5-testing-strategy)

---

## 1. Project Overview & Tech Stack

This is a full-stack web application built on **Nuxt 4**, using its unified file-based routing to serve both the Vue frontend and a Nitro-powered API backend from a single project. The server layer connects directly to a **PostgreSQL** database via **Drizzle ORM**, keeping database access type-safe and migration-driven without a separate backend service.

### Technology Stack

| Layer                | Technology                | Version             |
| -------------------- | ------------------------- | ------------------- |
| Frontend / SSR       | Nuxt 4                    | `^4.4.5`            |
| UI Component Library | Nuxt UI + Tailwind CSS v4 | `^4.7.1`            |
| Server Engine        | Nitro (bundled with Nuxt) | —                   |
| Database             | PostgreSQL                | `16` (Alpine)       |
| ORM                  | Drizzle ORM               | `^0.45.2`           |
| PostgreSQL Driver    | `pg` (node-postgres)      | `^8.21.0`           |
| Password Hashing     | bcrypt                    | `^6.0.0`            |
| Testing              | Vitest + @nuxt/test-utils | `^4.1.6` / `^4.0.3` |
| Language             | TypeScript                | `^6.0.3`            |
| Linting              | ESLint (@nuxt/eslint)     | `1.15.2`            |
| Formatting           | Prettier                  | `3.8.3`             |
| Git Hooks            | Husky                     | `^9.1.7`            |

---

## 2. Getting Started / Installation

### Prerequisites

- **Node.js** v20+ (LTS recommended)
- **pnpm** v9+
- **Docker** and **Docker Compose** (for local databases)

### 1. Clone the Repository

```bash
git clone https://github.com/hubatrifusz/website.git
cd website
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

The project uses two environment files — one for local development and one for the test suite.

**Create `.env` for the development server:**

```env
DATABASE_URL="postgres://admin:admin@localhost:5432/development"
```

**Create `.env.test` for the test suite:**

```env
DATABASE_URL="postgres://admin:admin@localhost:5433/testing"
```

> The dev and test databases run on different ports (`5432` and `5433`) to ensure complete isolation. Never point the test suite at the development database.

### 4. Start the Databases

Use Docker Compose to spin up both PostgreSQL instances simultaneously:

```bash
docker compose up -d
```

This starts two containers:

- `postgres_dev` — development database on port `5432`
- `postgres_test` — isolated test database on port `5433`

### 5. Run Database Migrations

Apply the Drizzle schema to both databases.

**Development database:**

```bash
pnpm drizzle-kit migrate
```

**Test database** (pass the test env explicitly):

```bash
dotenv -e .env.test -- pnpm drizzle-kit migrate
```

> If `dotenv` CLI is not available globally, run `npx dotenv-cli -e .env.test -- pnpm drizzle-kit migrate`.

### 6. Start the Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

---

## 3. Database Architecture

### How Drizzle ORM Integrates with Nuxt

Drizzle ORM is initialised once as a server-side singleton in [server/utils/db.ts](server/utils/db.ts). Because Nitro auto-imports everything from `server/utils/`, the exported `db` instance is available in every API route handler without an explicit import.

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

The connection string is read from `process.env.DATABASE_URL` at startup, so the same codebase connects to the dev database in development and the test database during the test suite — the environment variable is the only switch.

### Schema Definition

All table schemas live in [server/db/schema.ts](server/db/schema.ts) and are consumed by both the runtime (`db`) and Drizzle Kit (for migrations via [drizzle.config.ts](drizzle.config.ts)).

#### `users` Table

| Column         | DB Name         | Type           | Constraints                              |
| -------------- | --------------- | -------------- | ---------------------------------------- |
| `userId`       | `user_id`       | `uuid`         | Primary key, `DEFAULT gen_random_uuid()` |
| `firstName`    | `first_name`    | `varchar(255)` | `NOT NULL`                               |
| `lastName`     | `last_name`     | `varchar(255)` | `NOT NULL`                               |
| `email`        | `email`         | `varchar(255)` | `UNIQUE`, `NOT NULL`                     |
| `role`         | `role`          | `varchar(50)`  | `NOT NULL`, `DEFAULT 'user'`             |
| `passwordHash` | `password_hash` | `varchar(255)` | `NOT NULL`                               |
| `isVerified`   | `is_verified`   | `boolean`      | `NOT NULL`, `DEFAULT false`              |
| `createdAt`    | `created_at`    | `timestamptz`  | `NOT NULL`, `DEFAULT NOW()`              |
| `updatedAt`    | `updated_at`    | `timestamptz`  | `NOT NULL`, `DEFAULT NOW()`              |

#### `sessions` Table

| Column      | DB Name      | Type           | Constraints                                            |
| ----------- | ------------ | -------------- | ------------------------------------------------------ |
| `id`        | `id`         | `uuid`         | Primary key, `DEFAULT gen_random_uuid()`               |
| `userId`    | `user_id`    | `uuid`         | `NOT NULL`, FK → `users.user_id` (`ON DELETE CASCADE`) |
| `token`     | `token`      | `varchar(255)` | `UNIQUE`, `NOT NULL`                                   |
| `expiresAt` | `expires_at` | `timestamptz`  | `NOT NULL`                                             |
| `createdAt` | `created_at` | `timestamptz`  | `NOT NULL`, `DEFAULT NOW()`                            |

> Deleting a user automatically cascades to delete all of that user's sessions.

### Drizzle Kit Configuration

[drizzle.config.ts](drizzle.config.ts) points Drizzle Kit at the schema file and the target database. Migrations are output to the `./drizzle` directory.

```ts
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

## 4. API Endpoint Reference

### `POST /api/auth/register`

Registers a new user account. Validates all required fields, checks for duplicate emails, hashes the password with bcrypt, and persists the record to the `users` table.

**Source:** [server/api/auth/register.post.ts](server/api/auth/register.post.ts)

#### Request

```
POST /api/auth/register
Content-Type: application/json
```

**Body Parameters**

| Field       | Type     | Required | Description                                                               |
| ----------- | -------- | -------- | ------------------------------------------------------------------------- |
| `email`     | `string` | Yes      | The user's email address. Must be unique across all accounts.             |
| `firstName` | `string` | Yes      | The user's first name.                                                    |
| `lastName`  | `string` | Yes      | The user's last name.                                                     |
| `password`  | `string` | Yes      | Plain-text password. Hashed with bcrypt (salt rounds: 12) before storage. |

**Example Request Body**

```json
{
  "email": "alex.jones@example.com",
  "firstName": "Alex",
  "lastName": "Jones",
  "password": "securepass123"
}
```

#### Responses

**`200 OK` — Registration successful**

```json
{
  "success": true,
  "message": "User created successfully!"
}
```

**`400 Bad Request` — Missing required fields**

Returned when any of the four required fields is absent or falsy.

```json
{
  "statusCode": 400,
  "statusMessage": "Missing fields!"
}
```

**`400 Bad Request` — Email already registered**

Returned when a user with the given email already exists.

```json
{
  "statusCode": 400,
  "statusMessage": "User already exists!"
}
```

#### Security Notes

- Passwords are **never stored in plain text**. They are hashed using `bcrypt` with a salt cost factor of `12` before being written to `password_hash`.
- The endpoint does not return the created user object, preventing accidental exposure of the password hash or internal IDs.
- [TODO: Add rate limiting to prevent brute-force registration abuse.]
- [TODO: Add server-side email format validation.]
- [TODO: Implement auto sign-in (session creation) after successful registration.]

---

## 5. Testing Strategy

### Overview

The test suite uses **Vitest** as the test runner and **@nuxt/test-utils** for integration with the Nuxt/Nitro server. Tests are organised into three named projects within [vitest.config.ts](vitest.config.ts), each with its own environment and file glob pattern.

```
test/
├── unit/          # Pure unit tests (Vitest node environment)
├── e2e/           # E2E / integration tests against the live Nitro server
│   └── server/
│       └── api/
│           └── auth/
│               └── register.post.test.ts
└── nuxt/          # Component / composable tests (Vitest nuxt environment)
```

### Test Projects

| Project Name | Include Glob                    | Environment | Purpose                                                   |
| ------------ | ------------------------------- | ----------- | --------------------------------------------------------- |
| `unit`       | `test/unit/**/*.{test,spec}.ts` | `node`      | Isolated unit tests with no framework overhead            |
| `e2e`        | `test/e2e/**/*.{test,spec}.ts`  | `node`      | Integration tests against the Nitro API server            |
| `nuxt`       | `test/nuxt/*.{test,spec}.ts`    | `nuxt`      | Vue component and composable tests via `@nuxt/test-utils` |

### Running Tests

```bash
# Run all test projects
pnpm vitest run

# Run in watch mode
pnpm vitest

# Run a specific project
pnpm vitest run --project e2e

# Open the Vitest UI
pnpm vitest --ui
```

> The test suite reads `DATABASE_URL` from `.env.test`, so the test database must be running before executing the `e2e` project.

### Database Isolation Strategy

The E2E tests hit a **real, dedicated PostgreSQL instance** (port `5433`) — there are no mocks. This catches integration issues that in-memory or mocked databases would hide (e.g., constraint violations, type coercions, migration drift).

**Isolation is enforced at the test level** using a `beforeEach` hook that hard-deletes all rows from the `users` table before every individual test:

```ts
beforeEach(async () => {
  await db.delete(users)
})
```

This guarantees each test starts from a clean, deterministic state regardless of execution order, without requiring a full database drop-and-recreate between runs.

### E2E Test Coverage — `POST /api/auth/register`

The current test file at [test/e2e/server/api/auth/register.post.test.ts](test/e2e/server/api/auth/register.post.test.ts) covers:

| Test                  | Description                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `database connection` | Verifies the test database is reachable via a raw `SELECT 1` ping.                                      |
| `missing all fields`  | Asserts a `400` response with `"Missing fields!"` when the body is empty.                               |
| `existing user`       | Registers a user, then re-registers with the same email; asserts a `400` with `"User already exists!"`. |
| `happy path`          | Registers successfully and confirms the record exists in the database via a direct query.               |
| `password hashing`    | Confirms the stored `password_hash` does not equal the plain-text password.                             |
