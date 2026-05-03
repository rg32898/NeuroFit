# Changelog

All notable changes to NeuroFit are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-05-03

First end-to-end release. The mobile app, admin console, and API are all functional, the build is reproducible on a fresh laptop with `git + Node 20 + pnpm 9 + Docker`, and there are no load-bearing managed-platform dependencies.

### Added — by build prompt

- **Prompt 1 — Repo skeleton.** pnpm workspace, TypeScript project references, root `typecheck` + `build` scripts, `.gitignore`, MIT license.
- **Prompt 2 — Database.** `lib/db` Drizzle package with the user, session, refresh-token, and audit schema. drizzle-kit migrations + a seed script.
- **Prompt 3 — API server.** Express 5 app, esbuild bundle, Pino logging, Helmet, CORS, rate limiting, healthz endpoint, error envelope.
- **Prompt 4 — Auth.** Email/password (bcrypt), JWT access + refresh with rotation, Sign in with Apple, Sign in with Google. Forced-logout listener.
- **Prompt 5 — Catalogue + workout assembly.** `games` + `game_items` tables, deterministic per-day item selection, items API.
- **Prompt 6 — Adaptive engine.** Per-user-per-game EWMA of accuracy + RT, difficulty banding, item picker that obeys the band.
- **Prompt 7 — Progress events + streak engine.** `progress_events` table with `(userId, clientEventId)` UNIQUE, streak service with grace + restoration.
- **Prompt 8 — Reports + insights.** Daily / weekly aggregates, per-game progress, exposed via `/api/reports/*`.
- **Prompt 9 — Subscription core.** Status machine (free / trialing / active / grace / expired / canceled), `subscriptions` table, `/api/subscription/status`.
- **Prompt 10 — Notifications.** Email transport (Resend or SMTP, dev fallback to stdout), Expo Push integration, `push_tokens` table.
- **Prompt 11 — Mobile shell.** Expo SDK 54 + Expo Router, theme tokens, UI primitives, `lib/api.ts` typed fetch with refresh-on-401, `lib/auth-store.ts`, i18n.
- **Prompt 12 — Game engine + first three games.** Memory, Pattern Finder, Mental Arithmetic with shared `GameContainer`, grading helpers, and unit tests.
- **Prompt 13 — Remaining four games.** Synonym Match, Pairs Recall, Detail, Logic — same engine, same per-game grader.
- **Prompt 14 — Workout runner.** Sequencing, mid-workout cold-start resume, double-tap completion guard.
- **Prompt 15 — Streaks + reports UI.** Today screen, weekly view, history.
- **Prompt 16 — Profile + settings.** Account management, sign-out, locale, preferred game-type weights.
- **Prompt 17 — Subscription UI + billing webhooks.** Stripe checkout + webhook, Apple IAP receipt verification, Google Play Billing verification, billing cron.
- **Prompt 18 — Admin console.** Next.js 14 standalone app, BFF cookie auth, catalogue editor, user lookup, support actions, audit log viewer.
- **Prompt 19 — Offline mode + rewarded ads.** AsyncStorage 3-day TTL cache with foreground prefetch, NetInfo edge-trigger flush of the progress queue, `(userId, clientEventId)` idempotency end-to-end. Rewarded-only AdMob with 1/session cap, no-during-workout block, premium short-circuit before SDK init, opt-in CTA on the train tab.
- **Prompt 20 — Export hardening.** Root aggregate `.env.example`, `docker-compose.yml` (postgres + api + admin), multi-stage Dockerfiles for `artifacts/api-server` and `artifacts/admin`, `scripts/dev.sh` one-shot bootstrap, `.github/workflows/ci.yml` (typecheck + tests for all three artifacts), full `README.md` rewrite, `docs/architecture.md`, `LICENSE` (MIT), and this CHANGELOG.

[0.1.0]: https://example.com/your-org/neurofit/releases/tag/v0.1.0
