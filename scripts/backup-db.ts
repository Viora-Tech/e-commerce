#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
/**
 * Dumps the app's Postgres database (and, when the built-in local storage
 * provider is in use, its uploads folder), gzips them, and writes them to
 * Cloudflare R2 or a local folder with a 7-daily + 4-weekly retention policy
 * per dataset. Run from a cron job or a platform scheduler (Coolify's
 * Scheduled Tasks, etc) — see docs/ops/backups.md.
 *
 * Requires `pg_dump` on PATH (same major version as the Postgres server, or
 * newer), `tar` on PATH (only used when there is an uploads folder to back
 * up), and either BACKUP_LOCAL_DIR or the BACKUP_R2_* set. Never run
 * automatically by CI or by this codebase's own tests.
 */
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import {
  type BackupObject,
  backupKey,
  kindsForDate,
  parseBackupKey,
  selectKeysToDelete,
} from '@commerce/backup'
import { loadEnv } from '@commerce/config'
import { localStorageDir } from '@commerce/core'
import { r2Endpoint } from '@commerce/storage-r2'

/** Where a backup ends up: R2 (BACKUP_R2_*) or a local folder (BACKUP_LOCAL_DIR, wins when set). */
type BackupTarget = {
  put(key: string, body: Buffer, contentType: string): Promise<void>
  /** Every object under `postgres/` and `uploads/`, for retention. */
  list(): Promise<{ key: string }[]>
  deleteMany(keys: string[]): Promise<void>
  describe(): string
}

function r2Target(env: ReturnType<typeof loadEnv>): BackupTarget {
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
  const accountId = env.BACKUP_R2_ACCOUNT_ID as string
  const bucket = env.BACKUP_R2_BUCKET as string
  const client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(accountId),
    credentials: {
      accessKeyId: env.BACKUP_R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.BACKUP_R2_SECRET_ACCESS_KEY as string,
    },
  })
  return {
    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      )
    },
    async list() {
      const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket }))
      return (listed.Contents ?? []).flatMap((o) => (o.Key ? [{ key: o.Key }] : []))
    },
    async deleteMany(keys) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })) },
        }),
      )
    },
    describe: () => `R2 bucket ${bucket}`,
  }
}

/** Dev, or a single-server store with no R2 account: write straight to a folder on disk. */
function localTarget(dir: string): BackupTarget {
  return {
    async put(key, body) {
      const path = join(dir, key)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, body)
    },
    async list() {
      const out: { key: string }[] = []
      for (const dataset of ['postgres', 'uploads']) {
        for (const kind of ['daily', 'weekly']) {
          const sub = join(dir, dataset, kind)
          if (!existsSync(sub)) continue
          for (const name of await readdir(sub)) out.push({ key: `${dataset}/${kind}/${name}` })
        }
      }
      return out
    },
    async deleteMany(keys) {
      for (const key of keys) await rm(join(dir, key), { force: true })
    },
    describe: () => `local folder ${dir}`,
  }
}

function buildTarget(env: ReturnType<typeof loadEnv>): BackupTarget {
  if (env.BACKUP_LOCAL_DIR) return localTarget(env.BACKUP_LOCAL_DIR)
  return r2Target(env)
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

/**
 * Tars and gzips the local storage folder, or returns null when it does not
 * exist (no local storage in use, or nothing has been uploaded yet).
 */
async function tarUploadsDir(dir: string): Promise<Buffer | null> {
  if (!existsSync(dir) || !(await stat(dir)).isDirectory()) return null
  const entries = await readdir(dir)
  if (entries.length === 0) return null
  const result = spawnSync('tar', ['-czf', '-', '-C', dir, '.'], {
    maxBuffer: 1024 * 1024 * 1024,
  })
  if (result.error) throw new Error(`tar failed to start: ${result.error.message}`)
  if (result.status !== 0) {
    throw new Error(`tar exited ${result.status}: ${result.stderr?.toString() ?? ''}`)
  }
  return result.stdout
}

async function main() {
  const env = loadEnv(process.env)
  const target = buildTarget(env)

  console.log('backup-db: dumping database…')
  const dump = dumpAndGzip(env.DATABASE_URL_OWNER)
  console.log(`backup-db: dump is ${(dump.byteLength / 1024 / 1024).toFixed(1)} MiB gzipped`)

  const uploadsDir = localStorageDir()
  console.log(`backup-db: checking for a local uploads folder at ${uploadsDir}…`)
  const uploadsArchive = await tarUploadsDir(uploadsDir)
  if (uploadsArchive) {
    console.log(
      `backup-db: uploads archive is ${(uploadsArchive.byteLength / 1024 / 1024).toFixed(1)} MiB gzipped`,
    )
  } else {
    console.log('backup-db: no local uploads folder (not using local storage, or nothing in it)')
  }

  const now = new Date()
  for (const kind of kindsForDate(now)) {
    const key = backupKey(now, kind, 'postgres')
    await target.put(key, dump, 'application/gzip')
    console.log(`backup-db: wrote ${key} to ${target.describe()}`)
    if (uploadsArchive) {
      const uploadsKey = backupKey(now, kind, 'uploads')
      await target.put(uploadsKey, uploadsArchive, 'application/gzip')
      console.log(`backup-db: wrote ${uploadsKey} to ${target.describe()}`)
    }
  }

  console.log('backup-db: applying retention…')
  const listed = await target.list()
  const objects: BackupObject[] = listed.map((o) => parseBackupKey(o.key)).filter((o) => o !== null)
  const stale = selectKeysToDelete(objects)

  if (stale.length > 0) {
    await target.deleteMany(stale)
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
