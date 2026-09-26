# syntax=docker/dockerfile:1.7
#
# Production image for @commerce/storefront. Dokploy builds this ON the Lightsail server from
# the `main` branch (its own GitHub integration, auto-deploy on push) — there is no separate CI
# image build/push step. See deploy/README.md and
# apps/docs/content/developer-docs/operations/deployment.mdx.
#
# Build from the MONOREPO ROOT (bun install needs the root lockfile and every workspace's
# package.json), e.g.:
#   docker build -f apps/storefront/Dockerfile -t commerce-storefront .

FROM oven/bun:1.3.11-alpine AS base
WORKDIR /repo
RUN apk add --no-cache git ca-certificates

# --- Prune the monorepo down to what @commerce/storefront actually needs --------------------
FROM base AS pruner
RUN bun add -g turbo@2.11.2
COPY . .
RUN turbo prune @commerce/storefront --docker

# --- Install dependencies against the pruned lockfile/package.json set ----------------------
FROM base AS installer
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/bun.lock ./bun.lock
COPY patches ./patches
RUN bun install --frozen-lockfile

# --- Build with the full pruned source ------------------------------------------------------
FROM installer AS builder
COPY --from=pruner /repo/out/full/ .
# turbo prune only copies workspace packages, not root-only files — packages/core imports
# this one by relative path (see apps/docs/content/developer-docs/building/plugins.mdx).
COPY --from=pruner /repo/commerce.config.ts ./commerce.config.ts
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# See apps/admin/Dockerfile's identical line for why this is here (Dokploy builds on the live
# box, not a separate build server).
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN bun run build --filter=@commerce/storefront

# --- Minimal runtime image ------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

COPY --from=builder /repo/apps/storefront/public ./apps/storefront/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/storefront/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/storefront/.next/static ./apps/storefront/.next/static

USER nextjs
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/storefront/server.js"]
