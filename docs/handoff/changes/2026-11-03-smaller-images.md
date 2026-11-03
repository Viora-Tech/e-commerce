# Smaller images, and the worker build checks its imports

| Image | Before | After |
| --- | --- | --- |
| worker | 1.12 GB | 638 MB |
| admin | 901 MB | 692 MB |
| storefront | 577 MB | 393 MB |

- **worker** (`apps/worker/ops/prune-image.sh`, run by the Dockerfile): removes build and test tools
  that arrive as optional peers (better-auth → drizzle-kit, vitest; evlog → vite; esbuild, rolldown,
  typescript, sentry bundler plugins), glibc native binaries (the image is musl), dependency source
  maps, and drizzle's `*_snapshot.json` (the migrator reads only `meta/_journal.json` and the .sql
  files). The runtime stage is now a fresh stage that copies the pruned tree, so deleted files
  don't stay in a lower layer.
- **Import check:** the same script bundles `src/index.ts` and fails the image build on any
  import that does not resolve (allow-list: Playwright's optional `chromium-bidi`). It would have
  stopped image a66f7d7d2, whose worker crashed at start on `@commerce/dates` (fixed in #1079).
- **admin, storefront:** the runtime stage is plain `alpine:3.22` plus the official Node binary,
  without the unused bun binary (~90 MB); TypeScript and glibc sharp builds are removed from the
  traced standalone output.
- Checked by building all three and starting each container: worker loads every module (stops at
  the missing env), storefront/admin boot and answer health (503 without a database, same as the
  old images), sharp renders on the storefront.
- Docs: `codebuild.mdx` step 2 now matches the server (ECR credential helper, no stored login).
