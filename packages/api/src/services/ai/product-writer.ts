/**
 * "Write with AI" (product page): the product's photos plus its title and the merchant's
 * notes in, a suggested description, SEO title and description, tags and key specs out.
 * Nothing is saved here: the admin shows the suggestion next to what is there now, and the
 * merchant applies it to the form and saves as usual.
 *
 * Photos are read from the store's own storage under RLS (only the store's own media ids),
 * using the 640px WebP variant when the image pipeline made one (`writerPhotos` in core,
 * shared with bulk runs). No customer data is sent.
 */
import {
  clampProductCopy,
  generateStructured,
  type ProductCopy,
  ProductCopySchema,
  type ProductWriterInput,
  productWriterContent,
  productWriterInstructions,
  type WriterLanguage,
  type WriterTone,
} from '@commerce/ai'
import { writerPhotos } from '@commerce/core/ai-runtime'
import { withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

export type WriteProductInput = ProductWriterInput & {
  mediaIds: string[]
  tone: WriterTone
  language: WriterLanguage
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
    writerPhotos(tx, call.runtime.storeId, input.mediaIds),
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
