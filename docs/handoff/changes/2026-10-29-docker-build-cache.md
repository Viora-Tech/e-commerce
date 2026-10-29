# Docker builds keep Turbopack's and bun's caches between builds

Branch `perf/docker-build-cache`. No migration, no runtime change.

- `apps/admin/Dockerfile`, `apps/storefront/Dockerfile`: `next build` runs with a BuildKit cache
  mount on `.next/cache` (id `commerce-<app>-next-cache-$TARGETPLATFORM`, `sharing=locked`), so a
  rebuild on the same machine starts with Turbopack's build cache warm. `.next/standalone` and
  `.next/static` are written outside the mount and copied into the runner as before.
- All three Dockerfiles (admin, storefront, worker): `bun install` uses a shared cache mount
  (`commerce-bun-install-cache`) with `--backend=copyfile`, so node_modules holds real files.
  The worker image runs from its installer stage, so it no longer carries bun's cache.
- Checked with `docker buildx build --check` only. The speed-up was not measured: no image was
  built (builds crash Docker on the 15 GB PC while agents run). First real build to try: admin
  twice in a row with a small change between, compare the `next build` step time.
- GitHub Actions (`type=gha` cache) does not save cache mounts; no gain there, no harm.
- Clear locally: `docker builder prune --filter type=exec.cachemount`.
- Docs: Developer docs → Operations → Deployment, "Images".
