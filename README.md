# NeuroFit

NeuroFit is a brain-training mobile app — a daily 8-minute workout of seven cognitive games (memory, attention, language, math, logic) that adapts to the user's accuracy and reaction time, drives a streak engine, and ships with a self-serve subscription tier and an admin console for catalogue + user operations. Backend is plain Express + Postgres; the mobile client is Expo (React Native); the admin is Next.js. Nothing in the build, test, or deploy path requires a managed dev platform — clone, copy `.env`, run `docker compose up`, and you are off.

## Table of Contents

1. [Stack](#stack)
2. [Prerequisites](#prerequisites)
3. [Quickstart](#quickstart)
4. [Environment variables](#environment-variables)
5. [Project structure](#project-structure)
6. [Testing](#testing)
7. [Deployment recipes](#deployment-recipes)
8. [Going to production checklist](#going-to-production-checklist)
9. [License](#license)

## Stack

| Layer            | Tech                                                                |
| ---------------- | ------------------------------------------------------------------- |
| Mobile app       | Expo SDK 54, React Native, Expo Router, React Query, Zustand, i18next |
| Admin console    | Next.js 14 (App Router, standalone output), Tailwind                |
| API              | Node 20, Express 5, Zod, Pino, JWT (access + refresh), bcrypt       |
| Database         | Postgres 16, Drizzle ORM, drizzle-kit migrations                    |
| Contracts        | OpenAPI 3.1 → Orval-generated React Query hooks + Zod schemas       |
| Auth providers   | Email/password, Sign in with Apple, Sign in with Google             |
| Payments         | Stripe (web), Apple IAP (iOS), Google Play Billing (Android)        |
| Push + email     | Expo Push, Resend or SMTP                                           |
| Mobile ads       | Google AdMob (rewarded only, opt-in)                                |
| Tests            | Vitest (server + admin), Jest + React Native Testing Library (mobile) |
| Build orchestration | pnpm workspaces, esbuild (api), Next standalone (admin), Metro (mobile) |

## Prerequisites

- **Node 20** (we test against 20.x — newer also works)
- **pnpm 9** — `corepack enable && corepack prepare pnpm@9 --activate`
- **Docker** with the Compose plugin (Docker Desktop, Colima, OrbStack, etc.)
- For the mobile app: **Expo Go** on a phone (App Store / Play Store), or an iOS simulator / Android emulator.

## Quickstart

```bash
git clone <your-fork-url> neurofit
cd neurofit

# 1) one-shot bootstrap — copies .env files, boots Postgres, migrates + seeds
./scripts/dev.sh

# 2) in three separate terminals
pnpm --filter @workspace/api-server run dev    # → http://localhost:8080
pnpm --filter @workspace/admin       run dev   # → http://localhost:3100/admin
pnpm --filter @workspace/mobile      run dev   # scan QR with Expo Go
```

Or, run the full stack (api + admin + postgres) in containers:

```bash
docker compose up --build
```

## Environment variables

The repo keeps a per-artifact `.env.example` next to each `package.json` (the authoritative source loaded at runtime), plus a root `.env.example` that aggregates every variable so you can audit them in one place.

### API server (`artifacts/api-server/.env.example`)

| Variable | Required | Purpose | Provider |
| --- | --- | --- | --- |
| `PORT` | yes | API listen port | — |
| `NODE_ENV` | yes | `development` / `production` | — |
| `LOG_LEVEL` | no | Pino log level (default `info`) | — |
| `CORS_ORIGIN` | yes | Comma-separated allowed origins | — |
| `DATABASE_URL` | yes | Postgres connection string | [Neon](https://neon.tech), self-host, RDS |
| `JWT_ACCESS_SECRET` | yes | HMAC secret for access tokens | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | yes | HMAC secret for refresh tokens | `openssl rand -base64 48` |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | no | Token lifetimes | — |
| `CRON_SECRET` | yes | Bearer token for `/api/admin/cron/*` | `openssl rand -hex 32` |
| `SUPPORT_TOKEN` | yes | Bearer for support-only endpoints | `openssl rand -hex 32` |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | optional | Sign in with Apple | [Apple Developer](https://developer.apple.com/sign-in-with-apple/) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Sign in with Google | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | optional | Stripe billing + webhook verification | [Stripe](https://dashboard.stripe.com/apikeys) |
| `APPLE_SHARED_SECRET` | optional | Apple receipt verification | App Store Connect |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` / `GOOGLE_PLAY_PACKAGE_NAME` | optional | Google Play Billing verification | [Google Play Console](https://play.google.com/console) |
| `SUBSCRIPTION_TRIAL_DAYS` / `SUBSCRIPTION_REMINDER_HOURS` | no | Trial defaults | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | optional | Email transport | any SMTP host |
| `RESEND_API_KEY` | optional | Email via Resend (preferred if set) | [Resend](https://resend.com/api-keys) |
| `EXPO_ACCESS_TOKEN` | optional | Expo Push delivery | [Expo dashboard](https://expo.dev) |
| `FROM_EMAIL` | yes | Outbound transactional sender | — |

### Admin (`artifacts/admin/.env.example`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | Browser-side API base URL |
| `ADMIN_API_INTERNAL_URL` | no | Server-side BFF target (defaults to public URL) |
| `COOKIE_SECURE` | yes | `true` over HTTPS |

### Mobile (`artifacts/mobile/.env.example`)

| Variable | Required | Purpose | Provider |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | yes | Backend base URL (no trailing slash) | — |
| `EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT` | optional (prod) | AdMob rewarded unit ID — Android | [AdMob](https://apps.admob.com) |
| `EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT` | optional (prod) | AdMob rewarded unit ID — iOS | [AdMob](https://apps.admob.com) |

In `__DEV__` the app falls back to Google's official rewarded test ad units, so blank values are fine for local development.

## Project structure

```
.
├── artifacts/
│   ├── api-server/      # Express 5 API (Drizzle, Zod, Pino, esbuild bundle)
│   ├── admin/           # Next.js 14 admin console (standalone output)
│   ├── mobile/          # Expo SDK 54 client (React Native, Expo Router)
│   └── mockup-sandbox/  # Local design preview server (dev-only, not deployed)
├── lib/
│   ├── shared/          # Cross-package types + business logic
│   ├── api-spec/        # OpenAPI 3.1 spec (single source of truth)
│   ├── api-zod/         # Zod schemas generated from the spec
│   ├── api-client-react/# React Query hooks generated from the spec
│   └── db/              # Drizzle schema + migrations + drizzle.config.ts
├── scripts/
│   ├── dev.sh           # one-command local bootstrap
│   └── src/             # workspace utility scripts
├── docs/
│   └── architecture.md  # auth, workout assembly, streak, sync, trust layer
├── docker-compose.yml   # postgres + api + admin
├── .github/workflows/ci.yml
├── .env.example         # aggregate reference for every env var
├── pnpm-workspace.yaml
└── package.json
```

## Testing

```bash
# Whole monorepo typecheck (composite libs first, then leaf packages)
pnpm run typecheck

# Per-package
pnpm --filter @workspace/api-server run test     # vitest
pnpm --filter @workspace/admin       run test     # vitest
pnpm --filter @workspace/mobile      run test     # jest + RNTL
```

CI mirrors these exactly — see `.github/workflows/ci.yml`.

## Deployment recipes

### API → Render / Fly.io / Railway / your VPS

1. Build the image: `docker build -f artifacts/api-server/Dockerfile -t neurofit-api .`
2. Push to your registry, or have your platform build from the Dockerfile directly.
3. Provision a Postgres database (Neon, Render Postgres, Fly Postgres, AWS RDS, plain VM — all work).
4. Set every required env var from the table above, plus the production values for billing/auth providers.
5. Run migrations on first deploy: `pnpm --filter @workspace/api-server run db:migrate` (Render → "Pre-deploy command", Fly → `release_command`, Railway → "Deploy hook", VPS → systemd one-shot).
6. Schedule the daily + billing cron endpoints. Anything that can POST with a bearer token works:
   - `POST /api/admin/cron/daily`   (header `Authorization: Bearer $CRON_SECRET`) — once a day, 00:05 UTC.
   - `POST /api/admin/cron/billing` (same header) — every 15 minutes.
   - GitHub Actions, Render Cron Jobs, Fly machines on a schedule, cron-job.org, and plain `crontab` are all proven options.

### Admin → Vercel / Render / your VPS

- **Vercel:** point at the repo, set the project root to `artifacts/admin`, set env vars, deploy. (`output: "standalone"` is harmless on Vercel.)
- **Render / your VPS:** build the image with `docker build -f artifacts/admin/Dockerfile -t neurofit-admin .` and run it on port 3100. The standalone output runs as plain `node artifacts/admin/server.js` (the Dockerfile already wires this up as the default CMD).

### Mobile → EAS Build → App Store / Play Store

- **Build profiles:** `pnpm --filter @workspace/mobile exec eas build --profile production --platform ios` (and `--platform android`). EAS handles the native compile in the cloud — no Xcode/Android Studio required locally.
- **Submission:** `pnpm --filter @workspace/mobile exec eas submit -p ios` / `-p android` once the build finishes. App Store Connect needs an active app record + the Apple shared secret matching `APPLE_SHARED_SECRET`. Google Play needs the service account JSON matching `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
- Legacy `expo build` is **not** used — that pipeline was retired by Expo.

## Going to production checklist

- [ ] Strong, unique values for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`, `SUPPORT_TOKEN` (≥ 32 bytes of entropy each).
- [ ] `COOKIE_SECURE=true` on the admin and HTTPS terminating in front of every public service.
- [ ] `CORS_ORIGIN` restricted to known origins (admin URL + mobile web build, if any).
- [ ] DB backups configured (managed providers do this; on a VPS use `pg_dump` on a cron).
- [ ] Cron jobs scheduled and verified end-to-end with a successful response.
- [ ] Stripe webhook endpoint added and signing secret matching `STRIPE_WEBHOOK_SECRET`.
- [ ] Apple shared secret + Google Play service account uploaded to your secret manager.
- [ ] AdMob production unit IDs set in the mobile build env (test units only in dev).
- [ ] Push notification tokens collecting (verify a test send via the admin).
- [ ] Replace placeholder branding (`hello@neurofit.example`, app name in `app.json`, admin title) with your real brand.
- [ ] Run `pnpm run typecheck && pnpm -r run test` in CI on every PR (already wired in `.github/workflows/ci.yml`).

## License

MIT — see [LICENSE](./LICENSE).
