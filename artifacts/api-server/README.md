# NeuroFit API Server

Express 5 backend for the NeuroFit brain-training app.

## Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express 5
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (any provider — see below)
- **Auth**: JWT (access + refresh tokens, bcrypt passwords)
- **Validation**: Zod
- **Logging**: Pino (Authorization headers redacted)

## Getting Started

### 1. Environment variables

```bash
cp .env.example .env
```

**Database** — set `DATABASE_URL` to your PostgreSQL connection string. Any of these work:

| Provider | Notes |
|---|---|
| [Neon](https://neon.tech) | Serverless Postgres, generous free tier |
| [Supabase](https://supabase.com) | Postgres + extras, free tier available |
| [Railway](https://railway.app) | Simple Postgres deployments |
| Local Docker | `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16` |

**JWT secrets** — generate strong secrets (never commit real values):

```bash
openssl rand -base64 48   # run twice: once for ACCESS, once for REFRESH
```

Then set in `.env`:
```
JWT_ACCESS_SECRET=<output of first command>
JWT_REFRESH_SECRET=<output of second command>
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Migrate the database

```bash
pnpm --filter @workspace/api-server run db:generate
pnpm --filter @workspace/api-server run db:migrate
```

### 4. Seed initial data

```bash
pnpm --filter @workspace/api-server run db:seed
```

Inserts 6 games (one per domain) with 5 difficulty-banded items each, plus a demo user in development.

### 5. Start the dev server

```bash
pnpm --filter @workspace/api-server run dev
```

## Auth API

All error responses follow: `{ error: { code, message, requestId } }`

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Register with email + password |
| `POST` | `/api/auth/login` | — | Login, returns token pair |
| `POST` | `/api/auth/refresh` | — | Rotate tokens using refreshToken |
| `POST` | `/api/auth/logout` | Bearer | Invalidate refresh tokens |
| `GET` | `/api/auth/me` | Bearer | Current user + profile |
| `POST` | `/api/auth/apple` | — | Stub — returns 501 |
| `POST` | `/api/auth/google` | — | Stub — returns 501 |

### Sample requests

**Register**
```bash
curl -X POST /api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"supersecret"}'
# → 201 { user: { id, email }, accessToken, refreshToken }
```

**Login**
```bash
curl -X POST /api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"supersecret"}'
# → 200 { user: { id, email }, accessToken, refreshToken }
```

**Refresh**
```bash
curl -X POST /api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<token>"}'
# → 200 { accessToken, refreshToken }
```

**Me**
```bash
curl /api/auth/me \
  -H "Authorization: Bearer <accessToken>"
# → 200 { user: { id, email, createdAt }, profile: null | { ... } }
```

**Logout**
```bash
curl -X POST /api/auth/logout \
  -H "Authorization: Bearer <accessToken>"
# → 204
```

## Security notes

- Passwords hashed with bcrypt (12 rounds)
- Refresh tokens carry `tokenVersion`; logout increments it, invalidating all refresh tokens server-side
- `Authorization` headers are redacted from request logs
- Login is rate-limited to 10 requests/minute per IP

## Database scripts

| Script | Command |
|---|---|
| Generate migration | `pnpm --filter @workspace/api-server run db:generate` |
| Apply migrations | `pnpm --filter @workspace/api-server run db:migrate` |
| Seed data | `pnpm --filter @workspace/api-server run db:seed` |

## Tests

```bash
pnpm --filter @workspace/api-server run test
```

## Schema

All tables in `lib/db/src/schema/`:

| File | Tables |
|---|---|
| `users.ts` | `users` (+ `token_version` for refresh invalidation) |
| `profiles.ts` | `profiles` |
| `proficiency.ts` | `proficiency_scores` |
| `games.ts` | `games`, `game_items` |
| `sessions.ts` | `workout_sessions`, `progress_events` |
| `streaks.ts` | `streaks` |
| `subscriptions.ts` | `subscriptions` |
| `reports.ts` | `content_reports` |
