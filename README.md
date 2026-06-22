# Website

A full-stack web application built with Nuxt 4, Drizzle ORM, and Google OAuth 2.0.

## Tech Stack

- **Nuxt 4** — full-stack framework (Vue frontend + Nitro API server)
- **Tailwind CSS v4** via Nuxt UI
- **Drizzle ORM** with PostgreSQL (Docker)
- **Arctic** — Google OAuth 2.0 with PKCE
- **Vitest** + `@nuxt/test-utils` for unit and E2E tests

## Quick Start

```bash
pnpm install
docker compose up -d
pnpm drizzle-kit migrate
pnpm dev
```

See [DOCS.md](./DOCS.md) for the full documentation, including environment variable configuration, the database schema, the Google OAuth flow, and the testing strategy.
