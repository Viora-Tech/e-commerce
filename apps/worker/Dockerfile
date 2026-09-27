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

FROM oven/bun:1.3.11-alpine AS base
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
RUN bun install --frozen-lockfile --production
COPY --from=pruner /repo/out/full/ .
# turbo prune only copies workspace packages, not root-only files — packages/core imports
# this one by relative path (see apps/docs/content/developer-docs/building/plugins.mdx).
COPY --from=pruner /repo/commerce.config.ts ./commerce.config.ts

# --- Minimal runtime image -------------------------------------------------------------------
FROM installer AS runner
RUN addgroup -S bunapp && adduser -S worker -G bunapp \
  && chown -R worker:bunapp /repo/apps/worker
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
