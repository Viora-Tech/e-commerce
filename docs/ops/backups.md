# Database backups

`scripts/backup-db.ts` dumps the app's Postgres database with `pg_dump` (custom format `-Fc`),
gzips it, and uploads it to Cloudflare R2 with a **7 daily + 4 weekly** retention policy.
`scripts/restore-db.ts` reverses it with `pg_restore`. Both are plain scripts, run with `bun`,
not part of any app's build or test — nothing here runs automatically, and neither script is
ever invoked by CI or by this codebase's own test suite.

## What you need

- `pg_dump` and `pg_restore` on PATH, matching (or newer than) the Postgres server's major
  version — the same tools `bun run db:migrate` and friends assume are available.
- A Cloudflare R2 bucket, separate from (or the same as, your call) the one `@commerce/storage-r2`
  uses for store media. It's identified by its own env vars so backups don't depend on any
  store's own R2 app configuration:

  ```sh
  BACKUP_R2_ACCOUNT_ID=
  BACKUP_R2_ACCESS_KEY_ID=
  BACKUP_R2_SECRET_ACCESS_KEY=
  BACKUP_R2_BUCKET=
  ```

  Create an R2 API token scoped to Object Read & Write on that bucket only.

## Running a backup

```sh
bun scripts/backup-db.ts
```

This dumps `DATABASE_URL_OWNER` (the owner role has the full schema; the app's `app` role is
RLS-restricted and would produce an incomplete dump), gzips it, and uploads it as:

```
postgres/daily/<timestamp>.dump.gz
postgres/weekly/<timestamp>.dump.gz   # only on the first run of each ISO week (Monday, UTC)
```

Then it lists everything under `postgres/` in the bucket and deletes whatever is past
retention: older than the 7 newest daily backups, or older than the 4 newest weekly ones. Daily
and weekly are pruned independently, so a Monday backup counted as both never gets deleted twice
for the same reason.

The key naming and retention-selection logic lives in `@commerce/backup`
(`packages/backup/src/retention.ts`) as pure functions with no AWS SDK or `child_process`
dependency, so `packages/backup/test/retention.test.ts` covers it without touching Postgres,
R2 or Docker: `bun run test --cwd packages/backup`.

## Scheduling it

Run it once a day, off-peak. Two common setups:

- **Cron** (on a box that already has `bun`, the repo checked out, and `pg_dump`/`pg_restore`
  installed):

  ```cron
  0 3 * * * cd /path/to/repo && bun run --env-file=.env scripts/backup-db.ts >> /var/log/commerce-backup.log 2>&1
  ```

- **Coolify Scheduled Tasks**: add a scheduled command against the app's service —
  `bun scripts/backup-db.ts` — with the `BACKUP_R2_*` (and `DATABASE_URL_OWNER`) env vars set on
  that service, on a daily cron expression (e.g. `0 3 * * *`). Coolify runs it inside the same
  container image, so `pg_dump`/`pg_restore` need to be present there — add them to the image if
  they aren't already (they're on the worker/admin images that run `bun run db:migrate`).

## Restoring

```sh
bun scripts/restore-db.ts --list                                          # see what's in R2
bun scripts/restore-db.ts                                                  # restores the newest backup, into DATABASE_URL_OWNER
bun scripts/restore-db.ts --key postgres/daily/2026-09-24T03-00-00Z.dump.gz
bun scripts/restore-db.ts --target postgres://user:pass@host:5432/scratch  # restore somewhere else, e.g. to verify a backup
```

It downloads the object, gunzips it, and pipes it into `pg_restore --clean --if-exists
--no-owner`, which drops and recreates the objects the dump contains before restoring them —
**this overwrites existing data in the target database**. The script prints the target
(password masked) and requires typing `restore` to continue; there is no `--yes`/non-interactive
flag on purpose.

**Test restores on a scratch database first** (`--target` pointed at a throwaway Postgres, e.g.
`bun run infra:up` and a fresh database on that same instance) before ever restoring into a real
one. Nothing in this repository runs a restore for you.

## Why R2 and not something else

Reuses the same Cloudflare R2 the platform already integrates with for store media
(`packages/storage-r2`) and the existing `@aws-sdk/client-s3` dependency — R2's S3-compatible
API needs no new provider. Backups get their own bucket and credentials (`BACKUP_R2_*`) so a
compromised store's media R2 token has no path to the database backups.
