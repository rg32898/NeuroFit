# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @workspace/api-server.
#
# Stage 1 (builder): install full workspace deps, run codegen + bundle.
# Stage 2 (runner):  copy the bundled dist + production node_modules only.
#
# Build context is the repo root — `docker build -f artifacts/api-server/Dockerfile .`
# (docker-compose at the repo root sets this automatically).

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /repo

# Copy lockfile + workspace manifest + every package.json so pnpm can build
# the dependency graph deterministically before we copy source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts/api-server/package.json artifacts/api-server/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/db/package.json lib/db/
COPY lib/shared/package.json lib/shared/
COPY scripts/package.json scripts/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Now copy source for the api-server and every lib it transitively needs.
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/

# Build composite libs first (drizzle schemas, zod schemas, etc.) then bundle
# the api-server into a single dist/index.mjs via esbuild.
RUN pnpm run typecheck:libs && \
    pnpm --filter @workspace/api-server run build

# Prune dev dependencies for the runtime image.
RUN pnpm --filter @workspace/api-server --prod deploy /app

# ── Stage 2: runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache tini && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
# Migrations are read at runtime by `drizzle-kit migrate`.
COPY --from=builder --chown=nodejs:nodejs /repo/lib/db ./lib/db

USER nodejs
ENV NODE_ENV=production
EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
