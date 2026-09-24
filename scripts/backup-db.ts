#!/usr/bin/env bun
/**
 * Dumps the app's Postgres database, gzips it, and uploads it to R2 with a
 * 7-daily + 4-weekly retention policy. Run from a cron job or a platform
 * scheduler (Coolify's Scheduled Tasks, etc) — see docs/ops/backups.md.
 *
 * Requires `pg_dump` on PATH (same major version as the Postgres server, or
 * newer) and BACKUP_R2_* set. Never run automatically by CI or by this
 * codebase's own tests.
 */
import { spawnSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { backupKey, kindsForDate, parseBackupKey, selectKeysToDelete } from '@commerce/backup'
import { loadEnv } from '@commerce/config'
import { r2Endpoint } from '@commerce/storage-r2'

function requireBackupEnv(env: ReturnType<typeof loadEnv>) {
  const missing = (
    [
      'BACKUP_R2_ACCOUNT_ID',
      'BACKUP_R2_ACCESS_KEY_ID',
      'BACKUP_R2_SECRET_ACCESS_KEY',
      'BACKUP_R2_BUCKET',
    ] as const
  ).filter((k) => !env[k])
  if (missing.length > 0) {
    throw new Error(`backup-db: missing env: ${missing.join(', ')}. See docs/ops/backups.md.`)
  }
  return {
    accountId: env.BACKUP_R2_ACCOUNT_ID as string,
    accessKeyId: env.BACKUP_R2_ACCESS_KEY_ID as string,
    secretAccessKey: env.BACKUP_R2_SECRET_ACCESS_KEY as string,
    bucket: env.BACKUP_R2_BUCKET as string,
  }
}

/** Runs pg_dump in custom format against the owner connection and gzips the result. */
function dumpAndGzip(databaseUrl: string): Buffer {
  // -Fc: custom format (pg_restore's -l/-L selective restore, already compressed at level 6 by
  // default); we gzip again on top per the ops runbook so the object in R2 is a plain .gz a
  // human can `gunzip` without pg_restore to sanity-check size, independent of pg_dump's format.
  const result = spawnSync('pg_dump', ['-Fc', databaseUrl], {
    maxBuffer: 1024 * 1024 * 1024,
  })
  if (result.error) throw new Error(`pg_dump failed to start: ${result.error.message}`)
  if (result.status !== 0) {
    throw new Error(`pg_dump exited ${result.status}: ${result.stderr?.toString() ?? ''}`)
  }
  return gzipSync(result.stdout)
}

async function main() {
  const env = loadEnv(process.env)
  const backupCreds = requireBackupEnv(env)

  console.log('backup-db: dumping database…')
  const dump = dumpAndGzip(env.DATABASE_URL_OWNER)
  console.log(`backup-db: dump is ${(dump.byteLength / 1024 / 1024).toFixed(1)} MiB gzipped`)

  const client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(backupCreds.accountId),
    credentials: {
      accessKeyId: backupCreds.accessKeyId,
      secretAccessKey: backupCreds.secretAccessKey,
    },
  })

  const now = new Date()
  for (const kind of kindsForDate(now)) {
    const key = backupKey(now, kind)
    await client.send(
      new PutObjectCommand({
        Bucket: backupCreds.bucket,
        Key: key,
        Body: dump,
        ContentType: 'application/gzip',
      }),
    )
    console.log(`backup-db: uploaded ${key}`)
  }

  console.log('backup-db: applying retention…')
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: backupCreds.bucket, Prefix: 'postgres/' }),
  )
  const objects = (listed.Contents ?? [])
    .map((o) => (o.Key ? parseBackupKey(o.Key) : null))
    .filter((o) => o !== null)
  const stale = selectKeysToDelete(objects)

  if (stale.length > 0) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: backupCreds.bucket,
        Delete: { Objects: stale.map((Key) => ({ Key })) },
      }),
    )
    console.log(`backup-db: deleted ${stale.length} backup(s) past retention`)
  } else {
    console.log('backup-db: nothing past retention')
  }

  console.log('backup-db: done')
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
