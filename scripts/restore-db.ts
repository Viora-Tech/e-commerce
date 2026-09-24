#!/usr/bin/env bun
/**
 * Downloads a backup made by scripts/backup-db.ts from R2 and restores it
 * with `pg_restore`, against DATABASE_URL_OWNER unless --target is given.
 *
 *   bun scripts/restore-db.ts --list                 # show what's in R2
 *   bun scripts/restore-db.ts --key postgres/daily/2026-09-24T03-00-00Z.dump.gz
 *   bun scripts/restore-db.ts                         # restores the newest backup
 *   bun scripts/restore-db.ts --target postgres://... # restore somewhere other than DATABASE_URL_OWNER
 *
 * Restoring drops and recreates data in the target database. This script
 * asks for a typed confirmation before touching anything and is never run
 * by this codebase's own tests, CI, or by backup-db.ts itself.
 */
import { spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { gunzipSync } from 'node:zlib'
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { parseBackupKey } from '@commerce/backup'
import { loadEnv } from '@commerce/config'
import { r2Endpoint } from '@commerce/storage-r2'

function parseArgs(argv: string[]) {
  const args = {
    list: false,
    key: undefined as string | undefined,
    target: undefined as string | undefined,
  }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--list') args.list = true
    else if (argv[i] === '--key') args.key = argv[++i]
    else if (argv[i] === '--target') args.target = argv[++i]
  }
  return args
}

async function newestKey(client: S3Client, bucket: string): Promise<string> {
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: 'postgres/' }),
  )
  const objects = (listed.Contents ?? [])
    .map((o) => (o.Key ? parseBackupKey(o.Key) : null))
    .filter((o) => o !== null)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
  const newest = objects[0]
  if (!newest) throw new Error('restore-db: no backups found under postgres/ in that bucket')
  return newest.key
}

async function confirm(message: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(`${message}\nType "restore" to continue: `)
  rl.close()
  if (answer.trim() !== 'restore') throw new Error('restore-db: cancelled')
}

async function main() {
  const env = loadEnv(process.env)
  const args = parseArgs(process.argv.slice(2))

  const accountId = env.BACKUP_R2_ACCOUNT_ID
  const accessKeyId = env.BACKUP_R2_ACCESS_KEY_ID
  const secretAccessKey = env.BACKUP_R2_SECRET_ACCESS_KEY
  const bucket = env.BACKUP_R2_BUCKET
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('restore-db: missing BACKUP_R2_* env. See docs/ops/backups.md.')
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(accountId),
    credentials: { accessKeyId, secretAccessKey },
  })

  if (args.list) {
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: 'postgres/' }),
    )
    for (const o of listed.Contents ?? []) console.log(o.Key)
    return
  }

  const key = args.key ?? (await newestKey(client, bucket))
  const target = args.target ?? env.DATABASE_URL_OWNER

  await confirm(
    `restore-db: about to restore ${key} into ${target.replace(/:[^:@/]+@/, ':***@')}.\n` +
      'This overwrites existing rows in every table the dump touches.',
  )

  console.log(`restore-db: downloading ${key}…`)
  const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!got.Body) throw new Error('restore-db: empty object body')
  const gzipped = Buffer.from(await got.Body.transformToByteArray())
  const dump = gunzipSync(gzipped)

  console.log('restore-db: running pg_restore…')
  const result = spawnSync('pg_restore', ['--clean', '--if-exists', '--no-owner', '-d', target], {
    input: dump,
    maxBuffer: 1024 * 1024 * 1024,
  })
  if (result.error) throw new Error(`pg_restore failed to start: ${result.error.message}`)
  if (result.status !== 0) {
    throw new Error(`pg_restore exited ${result.status}: ${result.stderr?.toString() ?? ''}`)
  }
  console.log('restore-db: done')
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
