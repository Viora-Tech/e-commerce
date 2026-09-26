# syntax=docker/dockerfile:1.7
#
# Production image for @commerce/admin. Dokploy builds this ON the Lightsail server from the
# `main` branch (its own GitHub integration, auto-deploy on push) — there is no separate CI
# image build/push step. See deploy/README.md and
# apps/docs/content/developer-docs/operations/deployment.mdx.
#
# Build from the MONOREPO ROOT (bun install needs the root lockfile and every workspace's
# package.json), e.g.:
#   docker build -f apps/admin/Dockerfile -t commerce-admin .

FROM oven/bun:1.3.11-alpine AS base
WORKDIR /repo
# turbo prune needs git to read the repo (workspace detection); ca-certificates for bun install.
RUN apk add --no-cache git ca-certificates

# --- Prune the monorepo down to what @commerce/admin actually needs -------------------------
FROM base AS pruner
RUN bun add -g turbo@2.11.2
COPY . .
RUN turbo prune @commerce/admin --docker

# --- Install dependencies against the pruned lockfile/package.json set ----------------------
FROM base AS installer
COPY --from=pruner /repo/out/json/ .
# bunfig.toml / bun.lock's patchedDependencies (e.g. patches/cobe@2.0.1.patch, when present)
# must travel with the pruned tree so bun applies them during install.
COPY --from=pruner /repo/out/bun.lock ./bun.lock
COPY patches ./patches
RUN bun install --frozen-lockfile

# --- Build with the full pruned source ------------------------------------------------------
FROM installer AS builder
COPY --from=pruner /repo/out/full/ .
# turbo prune only copies workspace packages, not root-only files — packages/core and this
# app's customize-config.tsx both import these by relative path (see
# apps/docs/content/developer-docs/building/plugins.mdx).
COPY --from=pruner /repo/commerce.config.ts /repo/commerce.blocks.config.ts ./
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Caps the build's own heap growth so it fails with a clear OOM inside this one build instead
# of the kernel OOM-killer picking a victim among Postgres/dragonfly/the other live containers
# on the same box (Dokploy builds here — see deploy/docker-compose.prod.yml's header comment).
# Deploy off-peak; this doesn't create memory that isn't there.
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN bun run build --filter=@commerce/admin

# --- Minimal runtime image ------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3200
ENV HOSTNAME=0.0.0.0

COPY --from=builder /repo/apps/admin/public ./apps/admin/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/admin/.next/static ./apps/admin/.next/static

USER nextjs
EXPOSE 3200

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3200/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "apps/admin/server.js"]
