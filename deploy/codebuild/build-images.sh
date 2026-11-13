#!/usr/bin/env bash
# Usage: build-images.sh "worker admin storefront-hono storefront"
# Builds each app image with BuildKit and a registry cache on ECR, tags :<sha> and :dev-latest,
# pushes. Needs ECR_REGISTRY, ECR_PREFIX, GIT_SHA in the environment. Writes the apps it pushed
# to apps-built.txt, which the deploy step reads (an app skipped here is never deployed).
set -euo pipefail
: > apps-built.txt
for app in $1; do
  repo="$ECR_REGISTRY/$ECR_PREFIX/$app"
  # storefront-hono (Bun + Hono product pages) is built once its ECR repo exists; until then the
  # release goes on without it (nothing points at it while STOREFRONT_HONO_URL is unset).
  # batch-get-image (already allowed) fails only for a missing repo, not for a missing tag.
  if [ "$app" = "storefront-hono" ] && ! aws ecr batch-get-image --repository-name "$ECR_PREFIX/$app" --image-ids imageTag=buildcache >/dev/null 2>&1; then
    echo "==> skipping $app: ECR repo $ECR_PREFIX/$app does not exist yet"
    continue
  fi
  args=()
  # The only build-arg any Dockerfile reads (apps/admin/Dockerfile). Public, not a secret.
  if [ "$app" = "admin" ] && [ -n "${NEXT_PUBLIC_WORKER_URL:-}" ]; then
    args+=(--build-arg "NEXT_PUBLIC_WORKER_URL=$NEXT_PUBLIC_WORKER_URL")
  fi
  echo "==> building $app"
  docker buildx build \
    -f "apps/$app/Dockerfile" \
    ${args[@]+"${args[@]}"} \
    --cache-from "type=registry,ref=$repo:buildcache" \
    --cache-to "type=registry,ref=$repo:buildcache,mode=max,image-manifest=true,oci-mediatypes=true" \
    -t "$repo:$GIT_SHA" -t "$repo:dev-latest" \
    --push .
  printf '%s ' "$app" >> apps-built.txt
done
