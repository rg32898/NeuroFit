# NeuroFit API Server

Express 5 + Drizzle + Postgres. JWT auth (access + refresh), workouts,
adaptive engine, streaks, and subscriptions.

## Run

```bash
cp .env.example .env
pnpm --filter @workspace/api-server run dev
```

## Billing setup (FR-6.x)

Three providers are wired in. None of them require Replit-specific
configuration — every secret lives in `process.env`.

### Stripe (web checkout)

1. Create an account at <https://dashboard.stripe.com>.
2. Create a recurring product per plan in **Products** with the lookup keys
   `neurofit_monthly_v1` and `neurofit_yearly_v1` (matches the catalogue in
   `lib/shared/src/subscription.ts`). When you create the Stripe Checkout
   session, set `subscription_data.metadata.userId` to the NeuroFit user id
   so we can route webhook events back to the right account.
3. **Settings → Developers → API keys**: copy the secret key into
   `STRIPE_SECRET_KEY` in `.env`.
4. **Settings → Developers → Webhooks → Add endpoint**:
   - URL: `https://<your-domain>/api/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Local testing: install the Stripe CLI and run
   `stripe listen --forward-to localhost:8080/api/webhooks/stripe` — the CLI
   prints a `whsec_…` signing secret you can use as your dev
   `STRIPE_WEBHOOK_SECRET`. Trigger events with `stripe trigger
   customer.subscription.updated`.

The webhook **must** receive the raw request body — we mount it with
`express.raw({ type: "application/json" })` in `src/app.ts` BEFORE the
global JSON parser. Don't move it.

### Apple App Store (iOS in-app purchase)

1. Create an in-app subscription in App Store Connect with product IDs
   `neurofit_monthly_v1` and `neurofit_yearly_v1`.
2. **App Information → App-Specific Shared Secret**: copy the value into
   `APPLE_SHARED_SECRET`. We pass this to the legacy `/verifyReceipt`
   endpoint.
3. **App Store Server Notifications V2**: configure both production and
   sandbox URLs to `https://<your-domain>/api/webhooks/apple`. Notifications
   are persisted to `billing_events`; full JWS chain verification ships in
   Prompt 10.
4. Local testing: use the App Store sandbox tester accounts. Our verifier
   automatically retries `/verifyReceipt` against the sandbox endpoint when
   it sees status `21007`.

### Google Play (Android in-app purchase)

1. Create an in-app subscription in Google Play Console with product IDs
   `neurofit_monthly_v1` and `neurofit_yearly_v1`. Set
   `GOOGLE_PLAY_PACKAGE_NAME` to your package id.
2. In Google Cloud Console, create a service account with the
   **Android Publisher** API enabled. Grant it "View financial data" on the
   app from Play Console → Users and permissions.
3. Download the JSON key. Either:
   - Save it to a path on the server and point
     `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` at the absolute file path, or
   - Base64-encode it and put the encoded value into the env var directly
     (handy for hosts that only support env strings).
4. **Real-time Developer Notifications**: in Play Console → Monetization
   setup, set up a Pub/Sub topic that pushes to
   `https://<your-domain>/api/webhooks/google`. Production deployments
   should add OIDC authentication to the push subscription (verified in
   Prompt 10).

## Cron

`/api/admin/cron/daily` and `/api/admin/cron/billing` are protected by the
`CRON_SECRET` env var sent in the `x-cron-secret` header. Drive them from
**any** scheduler — Render Cron, Fly Machines, GitHub Actions, cron-job.org,
or plain crontab. Both endpoints are idempotent; calling them twice does
nothing harmful.

Recommended frequency:

- `/cron/daily` — once per day at 00:05 UTC (monthly freeze top-up).
- `/cron/billing` — every 30 minutes (catches FR-6.4 receipt-within-5-minutes).

## Tests

```bash
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run typecheck
```
