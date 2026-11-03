# syntax=docker/dockerfile:1.7
#
# Production image for @commerce/worker (BullMQ jobs + payment/shipment webhooks, port 4100).
# Built by .github/workflows/release.yml in GitHub Actions on every push to `main` and pushed
# to ghcr.io/viora-tech/worker; the server only pulls it. See deploy/README.md and
# apps/docs/content/developer-docs/operations/deployment.mdx.
#
# A `bun build --target=bun` single-file bundle was tried here to avoid shipping node_modules
# at all (it got the image to ~190 MB). Reverted: pdf-lib/fontkit (pulled in transitively via
# @commerce/invoices) resolve their embedded standard fonts through Node's package `imports`
# subpath map (`#standard-fonts/Helvetica`, a real file on disk, not a JS module bun's bundler
# can inline) — confirmed by actually running the bundled server.js, which failed with
# `Cannot find module '#standard-fonts/Helvetica'` on every request that touched invoices.
# That's a silent breakage risk in production (invoice PDFs), not an acceptable size/reliability
# trade — so this Dockerfile installs real (production-only) node_modules instead. If you
# revisit bundling, mark pdf-lib/@react-pdf/renderer `--external` and ship their node_modules
# folders alongside the bundle rather than trying to inline them.
#
# Build from the MONOREPO ROOT:
#   docker build -f apps/worker/Dockerfile -t commerce-worker .

FROM oven/bun:1.4.3-alpine AS base
WORKDIR /repo
RUN apk add --no-cache git ca-certificates

# --- Prune the monorepo down to what @commerce/worker actually needs ------------------------
FROM base AS pruner
RUN bun add -g turbo@2.11.2
COPY . .
RUN turbo prune @commerce/worker --docker

# --- Install production-only dependencies (deps layer first, cache-friendly) -----------------
FROM base AS installer
ENV NODE_ENV=production
COPY --from=pruner /repo/out/json/ .
# bunfig.toml / bun.lock's patchedDependencies (e.g. patches/cobe@2.0.1.patch) must travel with
# the pruned tree so bun applies them during install.
COPY --from=pruner /repo/out/bun.lock ./bun.lock
COPY patches ./patches
# bun's download cache in a BuildKit cache mount: see apps/admin/Dockerfile's install step.
# This image runs from this stage, so before this the cache itself shipped in the worker image.
RUN --mount=type=cache,id=commerce-bun-install-cache,sharing=locked,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --production --backend=copyfile --cache-dir=/root/.bun/install/cache
COPY --from=pruner /repo/out/full/ .
# turbo prune only copies workspace packages, not root-only files — packages/core imports
# this one by relative path (see apps/docs/content/developer-docs/building/plugins.mdx).
COPY --from=pruner /repo/commerce.config.ts ./commerce.config.ts
# Ops scripts run by hand in the worker container with its database settings. They sit in the
# worker app so they resolve the worker's own packages (every import must be a worker dependency).
# From /repo/apps/worker:
#   bun ops/reset-store-data.ts --store <slug>     store data reset, dry run unless --apply
#   bun ops/platform-unlimited.ts <slug>           unlimited plan for Koomerce's own store (--off)
COPY --from=pruner /repo/scripts/reset-store-data.ts ./apps/worker/ops/reset-store-data.ts
COPY --from=pruner /repo/scripts/platform-unlimited.ts ./apps/worker/ops/platform-unlimited.ts
# Trim what production never loads (worker/ops/prune-image.sh lists each group and why):
# build and test tools that arrive as optional peers (better-auth → drizzle-kit/vitest, evlog →
# vite), glibc-only native binaries that cannot load on Alpine, and drizzle's schema snapshots
# (the migrator reads only meta/_journal.json and the .sql files).
COPY apps/worker/ops/prune-image.sh /tmp/prune-image.sh
RUN sh /tmp/prune-image.sh /repo && rm /tmp/prune-image.sh

# --- Minimal runtime image -------------------------------------------------------------------
# A fresh stage: copying the pruned tree across leaves the deleted files behind in the
# installer's layers instead of shipping them (a delete in a later layer frees nothing).
FROM base AS runner
RUN addgroup -S bunapp && adduser -S worker -G bunapp
COPY --from=installer /repo /repo
# Theme pictures for the Themes page (`src/theme-screenshot.ts`): opt in with
# `--build-arg THEME_SCREENSHOTS=1`, which adds Alpine's Chromium (~150 MB on disk) and needs the
# worker's mem_limit raised to at least 768m. Without it the screenshot jobs are skipped.
ARG THEME_SCREENSHOTS=
RUN if [ "$THEME_SCREENSHOTS" = "1" ]; then apk add --no-cache chromium nss freetype harfbuzz ttf-freefont font-noto-emoji; fi
ENV THEME_SCREENSHOT_CHROMIUM=${THEME_SCREENSHOTS:+/usr/bin/chromium-browser}
RUN chown -R worker:bunapp /repo/apps/worker
ENV WORKER_PORT=4100
# Best-effort on bun (V8 heap flag semantics differ slightly); matches this service's
# mem_limit in deploy/docker-compose.prod.yml with headroom for BullMQ/ioredis buffers.
ENV NODE_OPTIONS=--max-old-space-size=320
WORKDIR /repo/apps/worker

USER worker
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:4100/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "src/index.ts"]
