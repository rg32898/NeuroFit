# NeuroFit — Architecture

This document is a short, accurate map of the moving parts. It does not duplicate code; it explains how the pieces fit together and where each functional requirement (FR-x) from the product brief lives.

## Topology

```
┌──────────────────┐    HTTPS    ┌──────────────────────────┐
│  Mobile (Expo)   │ ──────────► │  API server (Express)    │
│  iOS / Android   │             │  Node 20 + esbuild bundle│
└──────────────────┘             └────────┬─────────────────┘
                                          │
┌──────────────────┐    HTTPS              │ Drizzle / pg
│  Admin (Next.js) │ ────────────► same ───┤
└──────────────────┘                       ▼
                                    ┌─────────────┐
                                    │ Postgres 16 │
                                    └─────────────┘
```

All three artifacts are independent processes; the API is the only thing that talks to Postgres. The contract between client and server is OpenAPI 3.1 (`lib/api-spec`), and Orval generates the React Query hooks (`lib/api-client-react`) and Zod schemas (`lib/api-zod`) so the mobile app and the API never disagree on shapes.

## Auth flow (FR-1.x)

1. **Sign-up / sign-in** — email/password (bcrypt, 12 rounds), Sign in with Apple, or Sign in with Google. Each path lands in `routes/auth.ts` and returns an access + refresh token pair.
2. **Access token** — short-lived (15m default), HMAC-SHA256, carries `userId` and `role`. Sent as `Authorization: Bearer …`.
3. **Refresh token** — long-lived (30d), persisted server-side in `refresh_tokens` with a SHA-256 hash; rotated on every use, the old hash is revoked. Theft replay = revocation of the entire chain.
4. **Forced logout** — when the server returns 401 on a refresh, the mobile client fires `onForcedLogout` which clears secure-store + Zustand and bounces to the welcome screen. The admin's BFF clears its httpOnly cookie.

## Workout assembly (FR-2.x, FR-3.x)

1. `POST /api/workouts` builds today's workout for the user.
2. The assembler reads the user's recent accuracy + reaction-time history (per game type), maps it to a 1–5 difficulty, and pulls items from `lib/db` via the catalogue tables (`games`, `game_items`).
3. Items are deterministic per (userId, day, gameSlug) — re-requesting the same workout returns the same items so an offline retry is idempotent.
4. The mobile client persists the assembled workout locally so a cold start mid-workout resumes exactly where the user left off.

## Adaptive engine (FR-3.x)

After every game completion the server records a `progress_event` and updates a per-user, per-game-type EWMA of accuracy and median RT. The next workout assembly reads those EWMAs and shifts the item difficulty up/down by one notch when the confidence interval clears the bands defined in `lib/shared/src/adaptive.ts`.

## Streak engine (FR-4.x)

- A "day" is the user's local date, derived from the IANA timezone the device sends with each progress event.
- A streak day requires at least one `workout_completed` event.
- The streak service runs on every `workout_completed` and on the daily cron (`POST /api/admin/cron/daily`, bearer `CRON_SECRET`) which closes out yesterday for users in earlier timezones.
- Grace is one missed day per rolling 14 days; restoration is via the support endpoint (`POST /api/progress/restore-streak`, bearer `SUPPORT_TOKEN`).

## Subscription / billing (FR-6.x)

- Three providers: **Stripe** (web checkout), **Apple IAP** (iOS receipts), **Google Play Billing** (Android purchase tokens). All three converge on a single `subscriptions` row keyed by userId.
- Status machine: `free → trialing → active → grace → expired/canceled`. Webhooks (Stripe) and polling (Apple/Google via the billing cron `POST /api/admin/cron/billing`) drive the transitions.
- The mobile + admin clients read `GET /api/subscription/status` and use `active` / `trialing` / `grace` as the "premium unlocked" set.

## Sync model (FR-9.x)

- The mobile app writes every game completion to a local `progress_queue` (AsyncStorage, key `nf_progress_queue`).
- `flush()` POSTs batches of up to 50 events to `/api/progress/events`. Each event carries a stable `clientEventId` (UUID v4) generated at the moment of completion.
- The server's `progress_events` table has `UNIQUE (user_id, client_event_id)` — INSERTs use `ON CONFLICT DO NOTHING`. This guarantees that retries (after offline → online, after a 5xx, after a process kill) NEVER produce duplicate writes. The merge rule is "first write wins by clientEventId," not last-write-wins by timestamp.
- The client subscribes to `@react-native-community/netinfo`. On the offline → online edge it resets backoff and flushes immediately.
- For catalogue + items the client uses an AsyncStorage TTL cache (3 days). On a foreground event we prefetch the next workout's items so a flight-mode workout still has data; on a network read failure (genuine network error or 5xx) the GameContainer falls back to the cache.

## Rewarded ads (FR-7.x)

- Only **rewarded** ads, never interstitial / banner / native.
- One module: `artifacts/mobile/src/lib/ads.ts`, one public API: `showRewardedAd(reasonCode) → Promise<boolean>`.
- Caps enforced inside the module:
  - **FR-7.4** — at most one reward per app-open session (counter + in-flight lock).
  - **FR-7.5** — never while a workout is mounted (`workout-state.ts` flag toggled by `WorkoutRunnerScreen`).
  - **FR-7.7** — premium subscribers short-circuit BEFORE the SDK initialises (`configureAds({isPremium})` reads the React Query cache for `["subscription","status"]`).
- The CTA on the train tab is opt-in only and hidden until the subscription query resolves.

## Trust layer (FR-12.x)

- Admin is gated by an admin role on the user record; the BFF sets an httpOnly cookie after a server-side login that hits the same API.
- Admin write endpoints require the admin role on every request; the cookie is httpOnly + SameSite to mitigate CSRF at the browser level.
- Audit log: every admin mutation writes an `admin_audit` row (actor, action, target, before/after JSON).
- Support endpoints are bearer-token protected (`SUPPORT_TOKEN`) and never accept a user JWT — separating the trust boundary keeps a compromised user account from triggering support actions.

## Mapping to FR-IDs

| Area | FR | Lives in |
| --- | --- | --- |
| Auth (email + Apple + Google) | FR-1.1–1.5 | `artifacts/api-server/src/auth/`, `artifacts/mobile/src/lib/auth-store.ts` |
| Workout assembly | FR-2.x | `artifacts/api-server/src/services/workoutService.ts`, `lib/shared/src/workout.ts` |
| Adaptive difficulty | FR-3.x | `artifacts/api-server/src/services/adaptiveEngine.ts` |
| Streak engine | FR-4.x | `artifacts/api-server/src/services/streakService.ts`, `artifacts/api-server/src/streak/` |
| Reports + insights | FR-5.x | `artifacts/api-server/src/reports/`, `artifacts/api-server/src/services/progressSummaryService.ts` |
| Billing | FR-6.x | `artifacts/api-server/src/billing/`, `artifacts/api-server/src/services/billingService.ts` |
| Rewarded ads | FR-7.x | `artifacts/mobile/src/lib/ads.ts`, `artifacts/mobile/src/lib/workout-state.ts` |
| Notifications | FR-8.x | `artifacts/api-server/src/services/notifications/` |
| Offline + sync | FR-9.x | `artifacts/mobile/src/lib/{offline-cache,progress-queue}.ts` |
| Catalogue | FR-10.x | `lib/db/src/schema/games.ts`, `artifacts/api-server/src/catalogue/`, `artifacts/api-server/src/services/catalogueService.ts` |
| Profile + settings | FR-11.x | `artifacts/api-server/src/profile/`, `artifacts/mobile/app/(tabs)/profile.tsx` |
| Admin + trust | FR-12.x | `artifacts/admin/`, `artifacts/api-server/src/admin/`, `artifacts/api-server/src/routes/admin.ts` |
