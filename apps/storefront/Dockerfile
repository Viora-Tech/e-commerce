# syntax=docker/dockerfile:1.7
#
# Production image for @commerce/storefront. Built by .github/workflows/release.yml in GitHub
# Actions on every push to `main` and pushed to ghcr.io/viora-tech/storefront; the server only
# pulls it. See deploy/README.md and apps/docs/content/developer-docs/operations/deployment.mdx.
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
# bun's download cache in a BuildKit cache mount: see apps/admin/Dockerfile's install step.
RUN --mount=type=cache,id=commerce-bun-install-cache,sharing=locked,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --backend=copyfile --cache-dir=/root/.bun/install/cache

# --- Build with the full pruned source ------------------------------------------------------
FROM installer AS builder
# `next build` runs on Node, not Bun: Bun 1.3.11 segfaults mid-build on linux/arm64 (Graviton)
# under memory pressure. `bun run` honours the `#!/usr/bin/env node` shebang once Node exists.
# Build stage only; the runtime image is unchanged.
# Node comes from the official image, not Alpine's package: Alpine's nodejs lags security
# releases (it still served 22.23.2 after the CVE-2026-111497 fix in 22.23.4). The official
# binary carries full ICU, so en-IN / hi-IN format the same as in the browser (React #418).
COPY --from=node:22.23.4-alpine /usr/local/bin/node /usr/local/bin/node
RUN apk add --no-cache libstdc++ libgcc
COPY --from=pruner /repo/out/full/ .
# turbo prune only copies workspace packages, not root-only files — packages/core imports
# this one by relative path (see apps/docs/content/developer-docs/building/plugins.mdx).
COPY --from=pruner /repo/commerce.config.ts ./commerce.config.ts
# The storefront has no static files of its own yet, and git keeps no empty folders; the
# runner's COPY of public/ needs it to exist.
RUN mkdir -p apps/storefront/public
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Lean build (packages/config/src/lean-build.ts): types are checked before every PR with
# TypeScript 7 (`bun run typecheck`), so the build skips Next's slower TypeScript 5.9 pass, and
# two page workers instead of one per core. Measured: fits a 4 GB machine with 4 GB of swap.
ENV BUILD_TYPECHECK=0
ENV BUILD_CPUS=2
# See apps/admin/Dockerfile's identical line.
ENV NODE_OPTIONS=--max-old-space-size=4096
# Turbopack's build cache in a BuildKit cache mount: see apps/admin/Dockerfile's build step.
ARG TARGETPLATFORM
RUN --mount=type=cache,id=commerce-storefront-next-cache-$TARGETPLATFORM,sharing=locked,target=/repo/apps/storefront/.next/cache \
  bun run build --filter=@commerce/storefront
# Drop from the traced server what can never load: glibc builds of sharp (the image is musl,
# the linuxmusl build beside them is used) and TypeScript (traced from Next's config loader;
# the standalone server reads the saved config, never next.config.ts).
RUN cd /repo/apps/storefront/.next/standalone/node_modules/.bun \
  && rm -rf typescript@* @img+sharp-libvips-linux-x64@* @img+sharp-linux-x64@* \
  && find /repo/apps/storefront/.next/standalone -type l ! -exec test -e {} \; -delete

# --- Minimal runtime image ------------------------------------------------------------------
# Plain Alpine (the release the bun image is built on): the server runs on Node, so the bun
# binary that `base` carries (~90 MB) has no job here.
FROM alpine:3.22 AS runner
# Alpine fixes published after the base image (musl, zlib).
RUN apk upgrade --no-cache
# The standalone Next server runs on Node: Bun 1.3.11 fails to load Next's compiled
# server runtime ("Expected CommonJS module to have a function wrapper").
# Node comes from the official image, not Alpine's package: Alpine's nodejs lags security
# releases (it still served 22.23.2 after the CVE-2026-111497 fix in 22.23.4). The official
# binary carries full ICU, so en-IN / hi-IN format the same as in the browser (React #418).
COPY --from=node:22.23.4-alpine /usr/local/bin/node /usr/local/bin/node
RUN apk add --no-cache libstdc++ libgcc
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
  CMD node -e "fetch('http://127.0.0.1:3100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/storefront/server.js"]
