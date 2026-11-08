#!/usr/bin/env bun
/**
 * Gives media already in the bucket the `Cache-Control` new uploads get
 * (`MEDIA_CACHE_CONTROL`, `@commerce/storage/keys`): a year, immutable. Objects written before
 * that change were stored with none, so Cloudflare answered `cf-cache-status: DYNAMIC` and
 * browsers kept nothing between pages.
 *
 * Each object under `stores/<store>/media/` without a Cache-Control is copied onto itself with
 * the header (S3/R2 `CopyObject`, metadata replaced; type and custom metadata kept). Skipped:
 * anything that already has a Cache-Control, anything outside a media folder (invoices, labels,
 * theme thumbnails), and images written in the last 24 hours that are not variants, which may
 * still be originals waiting for the pipeline (EXIF and GPS not yet stripped).
 *
 * Idempotent; a second run finds nothing to do. Reads the bucket from the platform env:
 *
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET          (Cloudflare R2)
 *   or S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET[, S3_PATH_PREFIX]
 *
 *   bun scripts/media-cache-headers.ts                    # dry run: counts what would change
 *   bun scripts/media-cache-headers.ts --apply            # writes the headers
 *   bun scripts/media-cache-headers.ts --apply --store <storeId>   # one store's folder only
 *
 * Afterwards purge cdn.koomerce.app in Cloudflare (or wait for its cache to turn over) so the
 * edge picks up the new headers.
 */
import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { r2Endpoint } from '@commerce/storage-r2'
// Relative: the root package does not depend on @commerce/storage itself.
import { MEDIA_CACHE_CONTROL } from '../packages/storage/src/keys'

const DAY_MS = 24 * 60 * 60 * 1000
const PARALLEL = 8
const VARIANT = /-w\d+\.(?:avif|webp)$/i
const IMAGE = /\.(?:jpe?g|png|webp|gif|avif)$/i

function bucketFromEnv(env: Record<string, string | undefined>) {
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    return {
      bucket: env.R2_BUCKET,
      prefix: '',
      client: new S3Client({
        region: 'auto',
        endpoint: r2Endpoint(env.R2_ACCOUNT_ID),
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      }),
    }
  }
  if (env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_BUCKET) {
    return {
      bucket: env.S3_BUCKET,
      prefix: env.S3_PATH_PREFIX ? `${env.S3_PATH_PREFIX.replace(/^\/|\/$/g, '')}/` : '',
      client: new S3Client({
        region: env.S3_REGION,
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        },
      }),
    }
  }
  throw new Error('media-cache-headers: set the R2_* or S3_* bucket env (see the file header).')
}

/** Whether this object may be cached for a year, from its key and age alone. */
function eligible(key: string, lastModified: Date | undefined, now: number): boolean {
  if (!/(?:^|\/)stores\/[^/]+\/media\//.test(key)) return false
  if (VARIANT.test(key) || !IMAGE.test(key)) return true
  // A fresh image may still be the unprocessed original.
  return lastModified !== undefined && now - lastModified.getTime() > DAY_MS
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const storeAt = args.indexOf('--store')
  const storeId = storeAt === -1 ? null : args[storeAt + 1]
  const { client, bucket, prefix } = bucketFromEnv(process.env)
  const listPrefix = `${prefix}stores/${storeId ? `${storeId}/media/` : ''}`
  const now = Date.now()

  const candidates: string[] = []
  let token: string | undefined
  let listed = 0
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: listPrefix, ContinuationToken: token }),
    )
    for (const o of page.Contents ?? []) {
      listed += 1
      if (o.Key && eligible(o.Key, o.LastModified, now)) candidates.push(o.Key)
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (token)
  console.log(`media-cache-headers: ${listed} object(s) listed, ${candidates.length} media file(s)`)

  let changed = 0
  let kept = 0
  let failed = 0
  const work = [...candidates]
  const worker = async () => {
    for (let key = work.pop(); key !== undefined; key = work.pop()) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        if (head.CacheControl) {
          kept += 1
          continue
        }
        if (apply) {
          await client.send(
            new CopyObjectCommand({
              Bucket: bucket,
              Key: key,
              CopySource: `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
              MetadataDirective: 'REPLACE',
              ContentType: head.ContentType,
              Metadata: head.Metadata,
              CacheControl: MEDIA_CACHE_CONTROL,
            }),
          )
        }
        changed += 1
        if (changed % 500 === 0) console.log(`media-cache-headers: ${changed} done`)
      } catch (err) {
        failed += 1
        console.error(`media-cache-headers: ${key}: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))
  console.log(
    `media-cache-headers: ${apply ? 'APPLY' : 'dry run'}: ${changed} ${apply ? 'updated' : 'would be updated'}, ${kept} already had a Cache-Control, ${failed} failed`,
  )
  if (failed > 0) process.exitCode = 1
}

await main()
