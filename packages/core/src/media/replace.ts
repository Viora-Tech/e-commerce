/** SOURCE OF TRUTH: "Replace photo from link" — WHAT swaps the file behind an existing image media row for one fetched from a public https link (SSRF-guarded `safeFetch`, image types only, upload size cap), keeping the row's id so product galleries, variant photos, order and alt text stay as they were; the row goes back to `processing` and the caller queues the pipeline / WHY a small photo (480 px imported from Shopify) is fixed by a larger original without breaking which photo belongs to which colour */
import type { StoreTx } from '@commerce/db'
import { media } from '@commerce/db'
import {
  isAllowedContentType,
  isImageContentType,
  maxUploadBytesFor,
  mediaKey,
  type StorageProvider,
} from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { CommerceError } from '../errors'
import { type LookupAll, readCapped, safeFetch } from '../net/safe-fetch'
import { InvalidUpload } from './service'

export const ReplaceFromUrlSchema = z.object({
  id: z.uuid(),
  url: z
    .string()
    .trim()
    .url()
    .max(2000)
    .refine((u) => u.startsWith('https://'), 'The link must start with https://'),
})

export type ReplaceDeps = { fetch?: typeof fetch | undefined; lookup?: LookupAll | undefined }

/** The image at `url`, through the SSRF guard: public hosts only, image types only, capped. */
async function downloadImage(url: string, deps: ReplaceDeps) {
  const res = await safeFetch(url, {
    timeoutMs: 30_000,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(deps.lookup ? { lookup: deps.lookup } : {}),
  })
  if (!res.ok) {
    await res.body?.cancel()
    throw new InvalidUpload(`The link answered ${res.status}, so there is no image to use`)
  }
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!isAllowedContentType(contentType) || !isImageContentType(contentType)) {
    await res.body?.cancel()
    throw new InvalidUpload(`The link is ${contentType || 'not an image'}, not an image we accept`)
  }
  const bytes = await readCapped(res, maxUploadBytesFor(contentType))
  if (!bytes || bytes.byteLength === 0) {
    throw new InvalidUpload(
      `Images must be under ${Math.round(maxUploadBytesFor(contentType) / 1024 / 1024)} MB`,
    )
  }
  return { bytes, contentType }
}

/**
 * Puts the image at `url` behind media row `id`. The new original goes to a fresh key; the
 * row keeps its old variants and size until the pipeline (queued by the caller) writes the
 * new ones, so the store never shows a gap or an unoptimised file. The old original is
 * deleted; its old variant files are left in storage (a few small files per photo).
 */
export async function replaceImageFromUrl(
  tx: StoreTx,
  storeId: string,
  provider: StorageProvider,
  input: { id: string; url: string },
  deps: ReplaceDeps = {},
): Promise<{ id: string; url: string }> {
  const [row] = await tx.select().from(media).where(eq(media.id, input.id))
  if (!row) throw new CommerceError('NOT_FOUND', `Media ${input.id} not found`)
  if (!isImageContentType(row.contentType ?? '')) {
    throw new InvalidUpload('Only a photo can be replaced from a link')
  }
  if (row.status === 'pending') throw new InvalidUpload('This file has not finished uploading')

  const file = await downloadImage(input.url, deps)
  const filename = new URL(input.url).pathname.split('/').pop() || 'photo'
  const key = mediaKey({ storeId, filename, contentType: file.contentType, id: row.id })
  await provider.put({ key, body: file.bytes, contentType: file.contentType })
  const url = provider.publicUrl(key)
  await tx
    .update(media)
    .set({
      url,
      key,
      provider: provider.id,
      contentType: file.contentType,
      size: file.bytes.byteLength,
      status: 'processing',
      processError: null,
    })
    .where(eq(media.id, row.id))
  if (row.key && row.key !== key && row.provider === provider.id) {
    await provider.delete(row.key).catch(() => undefined)
  }
  return { id: row.id, url }
}
