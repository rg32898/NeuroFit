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
- **Workout routes** (`/api/workout/*`): GET `/today` (returns existing or creates), POST `/:id/complete` (validates gameIds against the planned session, rejects duplicates, applies engine + calls `streakService.recordCompletion`), POST `/signal-too-hard` (records signal + lowers).
- **Streak engine** (`api-server/src/services/streakService.ts`): the single authoritative streak path. `recordCompletion(userId, completedAt)` runs inside `db.transaction` with a `SELECT ... FOR UPDATE` lock to prevent lost-update races. State machine in UTC: diff=0 idempotent · diff=1 +1 · diff≥2 +1 if a freeze is available (consume one) else reset to 1 · diff<0 ignored. `MAX_FREEZES=2`, topped up monthly by the cron.
- **Progress + admin routes**: POST `/api/progress/events` (auth, batch ≤100, idempotent per `(userId, clientEventId)` via UNIQUE constraint, only fires the streak engine for *newly inserted* `game_completed` events) · GET `/api/progress/streak` · POST `/api/progress/restore-streak` (header `x-support-token` = `SUPPORT_TOKEN`, no JWT) · POST `/api/admin/cron/daily` (header `x-cron-secret` = `CRON_SECRET`, host-agnostic — Render/Fly/GitHub Actions/cron-job.org).
- **Production safety**: `config.ts` refuses to boot in `NODE_ENV=production` if `CRON_SECRET` or `SUPPORT_TOKEN` are still the dev placeholders.
- **Subscriptions** (FR-6.x): three providers — Apple `/verifyReceipt` (with sandbox 21007 retry), Google Play Subscriptions V2 (service account via `google-auth-library`), Stripe (server SDK + webhook signature verification). Plan catalog in `lib/shared/src/subscription.ts` (monthly $9.99 / yearly $79.99, 7-day trial, productIds `neurofit_{monthly,yearly}_v1`). `services/billing/index.ts` exports `validateAndSync(userId, input)` and `persistValidatedReceipt`. Mobile clients send store receipts to `POST /api/subscription/validate-receipt`; Stripe is webhook-driven. `cancelSubscription` only sets `cancelAtPeriodEnd=true` locally (the store is the source of truth for IAP — user must cancel in device settings). Audit trail in `billing_events` with UNIQUE on (provider, providerEventId) for replay-safe webhooks. `cancelAtPeriodEnd` is sticky: a SQL OR in upsert prevents stale provider webhooks from un-cancelling a user's intent.
- **Stripe webhook raw body**: `app.ts` mounts `/api/webhooks/stripe` with `express.raw({ type: "application/json" })` BEFORE the global `express.json()` so the HMAC signature stays verifiable. Don't move it.
- **Billing cron**: `POST /api/admin/cron/billing` (same `x-cron-secret` model as `/cron/daily`) runs FR-6.3 trial-end reminders (48h window, idempotent via `trial_reminder_sent_at`) + FR-6.4 receipt notifications (5-minute lookback, NOT EXISTS subquery on the notifications log).
- **Notification transport** (`services/notifications`): vendor-neutral. `sendEmail` tries Resend HTTP → SMTP (nodemailer) → log; `sendPush` tries Expo Push HTTP → log. Every call appends a row to the `notifications` table — the table is now a **send LOG** (not a queue) with `channel`, `template`, `recipient`, `status`, `error` columns. FR-8.4 enforced as a hard guard in `sendEmail`: any send with `marketing: true` is blocked unless `marketingOptIn: true` is also passed (logged with `error="marketing_send_without_optin"`). Transactional sends (receipts, trial reminders, support acks) bypass the guard by omitting the marketing flag.
- **Reports + Support**: `POST /api/reports/content` is idempotent within 24h per (reporter, gameItem) — duplicate returns the original with `idempotent: true` and 200 (vs 201 on fresh create). `POST /api/support/tickets` always sends a transactional ack email when an email is on file. `GET /api/support/tickets/:id` returns 404 for both "missing" and "owned by someone else" (no id-enumeration leak).
- **Push tokens** (`push_tokens` table): keyed by Expo push token (unique globally — re-registration moves the token to the new userId). Registration endpoint is a future prompt; `sendPush` reads what's there and gracefully degrades to log when empty.
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
