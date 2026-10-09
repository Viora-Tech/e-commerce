# syntax=docker/dockerfile:1.7
#
# Optional production image for @commerce/docs (Nextra, port 3500). Not part of the default
# deploy/docker-compose.prod.yml service list — the docs site has no customer traffic
# dependency, so it's fine to skip it on the Lightsail box and keep docs.waimers.in (if wanted)
# on a separate cheap static host instead. Included here so the option exists.
#
# Build from the MONOREPO ROOT, e.g.:
#   docker build -f apps/docs/Dockerfile -t commerce-docs .

FROM oven/bun:1.3.11-alpine AS base
WORKDIR /repo
RUN apk add --no-cache git ca-certificates

FROM base AS pruner
RUN bun add -g turbo@2.11.2
COPY . .
RUN turbo prune @commerce/docs --docker

FROM base AS installer
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/bun.lock ./bun.lock
COPY patches ./patches
RUN bun install --frozen-lockfile

FROM installer AS builder
# `next build` runs on Node, not Bun: Bun 1.3.11 segfaults mid-build on linux/arm64 (Graviton)
# under memory pressure. `bun run` honours the `#!/usr/bin/env node` shebang once Node exists.
# Build stage only; the runtime image is unchanged.
# icu-data-full: Alpine's nodejs ships English-only ICU data (icu-data-en), so Intl treats
# en-IN as en-US ("01/14/2026", "1,234,567") and drops hi-IN, while browsers use the real
# locale ("14/01/2026", "12,34,567"). Server and browser text then differ: React error #418.
RUN apk add --no-cache nodejs icu-data-full
COPY --from=pruner /repo/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN bun run build --filter=@commerce/docs

FROM base AS runner
# The standalone Next server runs on Node: Bun 1.3.11 fails to load Next's compiled
# server runtime ("Expected CommonJS module to have a function wrapper").
# icu-data-full: real en-IN/hi-IN formats on the server, see the builder stage (React #418).
RUN apk add --no-cache nodejs icu-data-full
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3500
ENV HOSTNAME=0.0.0.0

COPY --from=builder /repo/apps/docs/public ./apps/docs/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/docs/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/docs/.next/static ./apps/docs/.next/static

USER nextjs
EXPOSE 3500

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3500/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/docs/server.js"]
