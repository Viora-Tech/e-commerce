# The worker image carries the store data reset script

`scripts/reset-store-data.ts` (#870) needs the production database settings, and only the worker
container has them. The worker image is pruned to the worker's packages and had no `scripts/`.
Its Dockerfile now copies that one script into the worker app at
`/repo/apps/worker/ops/reset-store-data.ts`, where it resolves the worker's own packages.

Run it by hand from a Dokploy schedule on the worker. It is a dry run unless `--apply` is passed.

    bun run /repo/apps/worker/ops/reset-store-data.ts --store waimers            # dry run
    bun run /repo/apps/worker/ops/reset-store-data.ts --store waimers --apply    # delete

Nothing runs it on its own; the worker's start command is unchanged.
