#!/usr/bin/env bash
# Usage: build-images.sh "worker admin storefront"
# Builds each app image with BuildKit and a registry cache on ECR, tags :<sha> and :dev-latest,
# pushes. Needs ECR_REGISTRY, ECR_PREFIX, GIT_SHA in the environment.
set -euo pipefail
for app in $1; do
  repo="$ECR_REGISTRY/$ECR_PREFIX/$app"
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
done
