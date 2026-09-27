# Production deployment

Full runbook: `apps/docs/content/developer-docs/operations/deployment.mdx` (server setup,
Dokploy install, GitHub connection, domains, rollback, restore, key rotation, monitoring). This
folder holds the files that runbook references:

- `docker-compose.prod.yml` — the Dokploy Compose application. Every app service uses a
  prebuilt image from GHCR (`image: ghcr.io/viora-tech/<app>:${IMAGE_TAG:-latest}`); nothing is
  built on the server.
- `env.production.example` — every env var the compose file and apps need, one line each, no
  real values. Copy into Dokploy's environment editor.
- `postgres/init.sh` — first-boot script that creates the RLS-restricted `app` role (runs once,
  only on a fresh `pgdata` volume).
- `backup-cron.sh` — the docker-compose-only nightly backup loop (prefer Dokploy's own
  Scheduled Job feature where available — see `apps/docs/content/developer-docs/operations/backups.mdx`).
- `Dockerfile.tasks` — shared image for the one-shot `migrate` service and the `backup`
  service; see its own header comment for why it isn't pruned per-app like the others.

Per-app Dockerfiles live next to their app (`apps/admin/Dockerfile`,
`apps/storefront/Dockerfile`, `apps/worker/Dockerfile`, `apps/docs/Dockerfile`) — all built from
the **monorepo root** as build context, e.g., to test one locally:

```sh
docker build -f apps/admin/Dockerfile -t commerce-admin .
```

Images are built by `.github/workflows/release.yml` in GitHub Actions on every push to `main`
(admin, storefront, worker, tasks and docs), tagged with the commit sha and `latest`, and pushed
to `ghcr.io/viora-tech/<app>`. That workflow then calls Dokploy's deploy webhook (repo secret
`DOKPLOY_WEBHOOK_URL`, skipped if unset) and Dokploy pulls and restarts. The server never runs
`docker build` — building the admin needs ~7 GB, which crashed Docker on the 8 GB box.
