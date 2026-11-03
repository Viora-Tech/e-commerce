#!/bin/sh
# Removes from the worker image what production never loads. Run by apps/worker/Dockerfile
# after `bun install --production`; the argument is the repo root inside the image.
# Then it bundles src/index.ts as a resolve check, so the image build fails, not the running
# worker, when an import is missing: something removed here, or a workspace package that lists
# a runtime import under devDependencies (which `--production` skips). OPTIONAL lists the
# imports that never resolve and are never reached (Playwright's chromium-bidi).
set -eu
root="$1"
store="$root/node_modules/.bun"

unresolved() {
  (cd "$root/apps/worker" && bun build src/index.ts --target=bun --outdir=/tmp/resolve-check 2>&1 || true) |
    grep -o 'Could not resolve: "[^"]*"' | sort -u
  rm -rf /tmp/resolve-check
}
OPTIONAL='chromium-bidi/'
cd "$store"

# Build and test tools. They come in as optional peer dependencies (better-auth declares
# drizzle-kit and vitest, evlog declares vite), never as something the worker imports.
rm -rf \
  vitest@* @vitest+* vite@* rolldown@* @rolldown+* \
  esbuild@* @esbuild+* @esbuild-kit+* tsx@* lightningcss* \
  drizzle-kit@* typescript@* bun-types@* @types+* \
  @sentry+bundler-plugins@* sentry@*

# Native binaries for glibc Linux. The image is Alpine (musl): these cannot load here, and the
# musl builds next to them are the ones used.
rm -rf ./*-linux-x64-gnu@* ./*-linux-arm64* @img+sharp-libvips-linux-x64@* @img+sharp-linux-x64@*

# Source maps of dependencies (stack traces use our own code's maps).
find "$store" -name '*.map' -type f -delete

# drizzle-kit's schema snapshots: needed to generate the next migration, not to run them.
find "$root/packages/db/drizzle/meta" -name '*_snapshot.json' -delete

# Links left pointing at removed folders.
find "$root/node_modules" "$root/packages" "$root/apps" -type l ! -exec test -e {} \; -delete

missing=$(unresolved | grep -v "\"$OPTIONAL" || true)
if [ -n "$missing" ]; then
  echo "prune-image: the worker imports something the image does not have:" >&2
  echo "$missing" >&2
  exit 1
fi
