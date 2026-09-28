# Images built off the server

**Images built off the server** (27 September 2026, `claude/release-images-ghcr`): new
`.github/workflows/release.yml` builds admin, storefront, worker, tasks (migrate/backup) and docs
images on every push to `main`, pushes `ghcr.io/viora-tech/<app>:<sha>` and `:latest` (GHA
layer cache), then POSTs `DOKPLOY_WEBHOOK_URL` if that secret is set. `deploy/docker-compose.prod.yml`
uses `image: ...:${IMAGE_TAG:-latest}` + `pull_policy: always` (no `build:`); rollback = set
`IMAGE_TAG` to an older sha in Dokploy and redeploy. Dokploy auto-deploy must be **off** (the
workflow's webhook deploys once images exist); the server needs a `read:packages` token for
GHCR. Admin build takes repo variable `NEXT_PUBLIC_WORKER_URL`. `@aws-sdk/client-s3` moved from
root devDependencies to root dependencies (backup/restore scripts). No migration.
**Open issue found, not fixed**: the compose `internal` network is `internal: true` (no
internet egress) and `worker`/`backup`/`migrate` sit only on it, so the worker can't call
payment/shipping APIs and backups can't reach R2 — fix before the first deploy.
