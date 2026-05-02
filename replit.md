# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod v3 (workspace catalog pin) — `drizzle-zod` removed (v0.8 needs Zod v4)
- **Auth**: JWT access + refresh tokens, bcryptjs (12 rounds), `tokenVersion` for server-side refresh revocation
- **Shared schemas**: hand-written cross-app Zod schemas live in `lib/shared` (`profile`, `workout` subpaths). Do NOT use `lib/api-zod` — that's auto-generated.
- **Adaptive engine** (`api-server/src/services/adaptiveEngine.ts`): pure functions for RAISE/HOLD/LOWER decisions per FR-L8. RAISE only on TWO consecutive scores ≥70; LOWER on TWO consecutive ≤30 OR a `too_hard` newest event. Score deltas ±250 clamped server-side to [0, 5000] via atomic SQL.
- **Workout assembler** (`api-server/src/services/workoutService.ts`): pure `selectWorkoutGames`, picks 3–5 games, always includes focus domain, balances other domains by inverse 7-day play count, respects free-tier rotation, soft 12-min target with hard 3-game floor.
- **Workout routes** (`/api/workout/*`): GET `/today` (returns existing or creates), POST `/:id/complete` (validates gameIds against the planned session, rejects duplicates, applies engine + bumps streak), POST `/signal-too-hard` (records signal + lowers).
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
