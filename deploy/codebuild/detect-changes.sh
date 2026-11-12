#!/usr/bin/env bash
# Prints the apps to build (space separated, deploy order: worker admin storefront-hono storefront).
# The last deployed sha per app lives in SSM at /vextro/deploy/last-sha/<app>, written by
# deploy-dokploy.mjs only after that app deployed healthy. A missing/unknown sha, or
# BUILD_ALL=1, builds the app. Same idea as the server's nightly script: only apps whose
# watch paths changed since their last deploy. The CodeBuild source needs full git history.
set -euo pipefail

# Inputs every image depends on, plus the app's own folder.
COMMON=(packages patches bun.lock package.json turbo.json commerce.config.ts commerce.blocks.config.ts .dockerignore)

head_sha="$(git rev-parse HEAD)"
out=()
for app in worker admin storefront-hono storefront; do
  if [ "${BUILD_ALL:-0}" = "1" ]; then out+=("$app"); continue; fi
  last="$(aws ssm get-parameter --name "/vextro/deploy/last-sha/$app" --query Parameter.Value --output text 2>/dev/null || true)"
  if [ -z "$last" ] || ! git cat-file -e "$last^{commit}" 2>/dev/null; then out+=("$app"); continue; fi
  paths=("apps/$app" "${COMMON[@]}")
  # The Hono product page server runs the storefront's own modules, so it changes with them.
  if [ "$app" = "storefront-hono" ]; then paths+=("apps/storefront"); fi
  existing=()
  for p in "${paths[@]}"; do [ -e "$p" ] && existing+=("$p"); done
  if [ -n "$(git diff --name-only "$last" "$head_sha" -- "${existing[@]}")" ]; then out+=("$app"); fi
done
echo "${out[*]:-}"
