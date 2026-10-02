/**
 * "Write with AI" (product page): the product's photos plus its title and the merchant's
 * notes in, a suggested description, SEO title and description, tags and key specs out.
 * Nothing is saved here: the admin shows the suggestion next to what is there now, and the
 * merchant applies it to the form and saves as usual.
 *
 * Photos are read from the store's own storage under RLS (only the store's own media ids),
 * using the 640px WebP variant when the image pipeline made one. No customer data is sent.
 */
import {
  clampProductCopy,
  generateStructured,
  type ProductCopy,
  ProductCopySchema,
  type ProductWriterInput,
  productWriterContent,
  productWriterInstructions,
  WRITER_MAX_PHOTOS,
  type WriterLanguage,
  type WriterTone,
} from '@commerce/ai'
import { settingsSecret } from '@commerce/config'
import { storageForStore, variantKey } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { media, type StoreTx, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { inArray } from 'drizzle-orm'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

export type WriteProductInput = ProductWriterInput & {
  mediaIds: string[]
  tone: WriterTone
  language: WriterLanguage
}

/** Model-friendly photo formats; anything else (video, SVG, GIF) is skipped. */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
/** A photo bigger than this is skipped rather than sent (the 640px variant is ~50 KB). */
const MAX_PHOTO_BYTES = 4 * 1024 * 1024
const VISION_WIDTH = 640

type Photo = { data: Uint8Array; mediaType: string }

async function loadPhotos(tx: StoreTx, storeId: string, ids: string[]): Promise<Photo[]> {
  if (!ids.length) return []
  // RLS: another store's media id simply finds no row.
  const rows = await tx
    .select({
      id: media.id,
      key: media.key,
      contentType: media.contentType,
      variants: media.variants,
    })
    .from(media)
    .where(inArray(media.id, ids))
  const ordered = ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is (typeof rows)[number] =>
      Boolean(r?.key && IMAGE_TYPES.has(r.contentType ?? '')),
    )
    .slice(0, WRITER_MAX_PHOTOS)
  if (!ordered.length) return []
  const registries = await registriesForStore(tx, storeId)
  const storage = await storageForStore(tx, storeId, registries.storage, settingsSecret())
  const photos: Photo[] = []
  for (const row of ordered) {
    const key = row.key as string
    const hasVariant = Boolean(
      (row.variants as Record<string, unknown> | null)?.[String(VISION_WIDTH)],
    )
    const bytes = await storage
      .get(hasVariant ? variantKey(key, VISION_WIDTH, 'webp') : key)
      .catch(() => null)
    if (!bytes || bytes.byteLength > MAX_PHOTO_BYTES) continue
    photos.push({ data: bytes, mediaType: hasVariant ? 'image/webp' : (row.contentType as string) })
  }
  return photos
}

export type WriteProductResult = {
  copy: ProductCopy
  /** How many photos the model actually looked at. */
  photosUsed: number
}

export async function writeProduct(
  context: AiCallContext,
  input: WriteProductInput,
  signal?: AbortSignal,
): Promise<WriteProductResult> {
  const call = await startAiCall(context, 'productWriter')
  const photos = await withStore(context.db, call.runtime.storeId, (tx) =>
    loadPhotos(tx, call.runtime.storeId, input.mediaIds),
  )
  try {
    const { output, usage } = await generateStructured({
      runtime: call.runtime,
      model: call.model,
      schema: ProductCopySchema,
      instructions: productWriterInstructions({ tone: input.tone, language: input.language }),
      content: productWriterContent(input, photos),
      abortSignal: signal,
    })
    await finishAiCall(context.db, call, usage)
    return { copy: clampProductCopy(output), photosUsed: photos.length }
  } catch {
    throw new ORPCError('BAD_GATEWAY', {
      message: 'The AI writer could not finish this time. Please try again.',
      data: { reason: 'model_failed' },
    })
  }
}
