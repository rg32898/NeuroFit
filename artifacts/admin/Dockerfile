# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @workspace/admin (Next.js 14 standalone output).
#
# Build context is the repo root — `docker build -f artifacts/admin/Dockerfile .`.

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts/admin/package.json artifacts/admin/
COPY lib/shared/package.json lib/shared/
COPY lib/api-zod/package.json lib/api-zod/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY lib/ lib/
COPY artifacts/admin/ artifacts/admin/

# Build composite libs first, then the Next.js standalone bundle.
RUN pnpm run typecheck:libs && \
    pnpm --filter @workspace/admin run build

# ── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache tini && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Next.js standalone output bundles only what's needed for `node server.js`.
COPY --from=builder --chown=nodejs:nodejs /repo/artifacts/admin/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /repo/artifacts/admin/.next/static ./artifacts/admin/.next/static
COPY --from=builder --chown=nodejs:nodejs /repo/artifacts/admin/public ./artifacts/admin/public

USER nodejs
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0
EXPOSE 3100

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "artifacts/admin/server.js"]
