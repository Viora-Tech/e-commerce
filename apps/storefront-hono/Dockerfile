# syntax=docker/dockerfile:1.7
#
# Image for @commerce/storefront-hono: product pages of the stores switched on
# (`preferences.delivery.honoProduct`), drawn by Bun + Hono behind the Next storefront, which
# forwards them here and draws the page itself on any failure (apps/storefront/src/lib/hono-island).
# It is reached only from the storefront container (internal network, no Traefik route).
#
# Lean on purpose (peak build memory matters more than build time, see docs/research):
# - no `next build`: Bun runs the TypeScript directly, so the heaviest step is `bun install`;
# - the only build step is the buy box island bundle (`scripts/build-island.ts`, a few seconds);
# - one runtime stage on the Bun image the other apps use (`packageManager`: bun@1.3.11).
#
# Build from the MONOREPO ROOT (bun install needs the root lockfile and every workspace's
# package.json), e.g.:
#   docker build -f apps/storefront-hono/Dockerfile -t commerce-storefront-hono .

FROM oven/bun:1.3.11-alpine AS base
WORKDIR /repo

# --- Prune the monorepo down to what @commerce/storefront-hono needs ------------------------
FROM base AS pruner
RUN bun add -g turbo@2.11.2
COPY . .
RUN turbo prune @commerce/storefront-hono --docker

# --- Install production dependencies against the pruned lockfile ----------------------------
FROM base AS installer
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/bun.lock ./bun.lock
COPY patches ./patches
# bun's download cache in a BuildKit cache mount: see apps/admin/Dockerfile's install step.
RUN --mount=type=cache,id=commerce-bun-install-cache,sharing=locked,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --production --backend=copyfile --cache-dir=/root/.bun/install/cache

# --- Source, island bundle, run -------------------------------------------------------------
FROM installer AS runner
COPY --from=pruner /repo/out/full/ .
# turbo prune only copies workspace packages; packages/core imports this one by relative path.
COPY --from=pruner /repo/commerce.config.ts ./commerce.config.ts
ENV NODE_ENV=production
RUN cd apps/storefront-hono && bun scripts/build-island.ts
ENV PORT=3200
WORKDIR /repo/apps/storefront-hono
USER bun
EXPOSE 3200

# The first start transpiles the storefront modules it loads (no build step), so give it time.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3200/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run from this folder so bunfig.toml's preload (src/preload.ts) applies.
CMD ["bun", "src/server.ts"]
