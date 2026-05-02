# NeuroFit API Server

Express 5 backend for the NeuroFit brain-training app.

## Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express 5
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (any provider — see below)
- **Validation**: Zod
- **Logging**: Pino

## Getting Started

### 1. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Set `DATABASE_URL` to your PostgreSQL connection string. Any of these
providers work out of the box:

| Provider | Notes |
|---|---|
| [Neon](https://neon.tech) | Serverless Postgres, generous free tier |
| [Supabase](https://supabase.com) | Postgres + extras, free tier available |
| [Railway](https://railway.app) | Simple Postgres deployments |
| Local Docker | `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres:16` |

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create and migrate the database

Generate a migration from the current schema:

```bash
pnpm --filter @workspace/api-server run db:generate
```

Apply migrations to your database:

```bash
pnpm --filter @workspace/api-server run db:migrate
```

### 4. Seed initial data

Inserts 6 games (one per domain) with 5 difficulty-banded items each,
and a demo user (development only):

```bash
pnpm --filter @workspace/api-server run db:seed
```

### 5. Start the dev server

```bash
pnpm --filter @workspace/api-server run dev
```

The server starts at `http://localhost:8080`. Health check:

```bash
curl http://localhost:8080/api/healthz
```

## Database Scripts

| Script | Command |
|---|---|
| Generate migration | `pnpm --filter @workspace/api-server run db:generate` |
| Apply migrations | `pnpm --filter @workspace/api-server run db:migrate` |
| Seed data | `pnpm --filter @workspace/api-server run db:seed` |

## Schema

All tables live in `lib/db/src/schema/`:

| File | Tables |
|---|---|
| `users.ts` | `users` |
| `profiles.ts` | `profiles` |
| `proficiency.ts` | `proficiency_scores` |
| `games.ts` | `games`, `game_items` |
| `sessions.ts` | `workout_sessions`, `progress_events` |
| `streaks.ts` | `streaks` |
| `subscriptions.ts` | `subscriptions` |
| `reports.ts` | `content_reports` |

## Tests

```bash
pnpm --filter @workspace/api-server run test
```
