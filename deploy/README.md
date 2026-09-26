# Production deployment

Full runbook: `apps/docs/content/developer-docs/operations/deployment.mdx` (server setup,
Dokploy install, GitHub connection, domains, rollback, restore, key rotation, monitoring). This
folder holds the files that runbook references:

- `docker-compose.prod.yml` — the Dokploy Compose application. Every service's image is built
  by Dokploy itself, on the server, straight from the Dockerfiles referenced below (`build:`,
  not `image:`) — there is no CI pipeline or container registry in this setup.
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

On the server, Dokploy connects to the `Viora-Tech/e-commerce` GitHub repo directly (its own
GitHub App integration) and rebuilds/redeploys this Compose application on every push to
`main` — see the runbook's "Connect GitHub" and "First deploy" sections. Builds run on the same
box that serves traffic (this plan has no separate build server), so deploy off-peak — the
runbook covers the mitigations in the compose file's own header comment.
