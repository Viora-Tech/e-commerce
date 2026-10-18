/** SOURCE OF TRUTH: reading a purchase document with AI — WHAT claims a queued document, admits
 * and meters one AI call, sends the PDF's text (or the scan or photo itself) with the kind's
 * schema, and stores what came back with the raw text, or a plain failure reason / WHY the
 * worker (and the API in tests) read documents the same way, and no transaction stays open
 * while a model reads. The result is only a proposal: Apply is a separate, reviewed step.
 */
import {
  aiModel,
  DOCUMENT_SCHEMAS,
  documentReaderContent,
  documentReaderInstructions,
  generateStructured,
  pdfText,
} from '@commerce/ai'
import { type Db, purchaseDocument, type StoreTx, withStore } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import type { z } from 'zod'
import { type DocumentReadError, shapeForKind } from '../inventory/document-rules'
import { documentStorage } from '../inventory/documents'
import { admitAiCall } from './quota'
import { recordAiUsage } from './usage'

export type ReadDocumentOptions = {
  db: Db
  storeId: string
  documentId: string
  signal?: AbortSignal | undefined
}

async function fail(opts: ReadDocumentOptions, error: DocumentReadError): Promise<void> {
  await withStore(opts.db, opts.storeId, (tx) =>
    tx
      .update(purchaseDocument)
      .set({ status: 'failed', error, updatedAt: new Date() })
      .where(and(eq(purchaseDocument.id, opts.documentId), eq(purchaseDocument.status, 'reading'))),
  )
}

/** Takes a pending document (or one a crashed run left reading), or null when there is nothing to do. */
async function claim(opts: ReadDocumentOptions) {
  return withStore(opts.db, opts.storeId, async (tx) => {
    const [row] = await tx
      .update(purchaseDocument)
      .set({ status: 'reading', error: null, updatedAt: new Date() })
      .where(
        and(
          eq(purchaseDocument.id, opts.documentId),
          inArray(purchaseDocument.status, ['pending', 'reading']),
        ),
      )
      .returning()
    return row ?? null
  })
}

/** Reads one document. Never throws for the document's own problems: they end as `failed`. */
export async function readPurchaseDocument(opts: ReadDocumentOptions): Promise<void> {
  const doc = await claim(opts)
  if (!doc) return
  const ctx = (tx: StoreTx) => ({ storeId: opts.storeId, tx })
  const admission = await withStore(opts.db, opts.storeId, (tx) =>
    admitAiCall(ctx(tx), 'documentReader'),
  )
  if (!admission.ok) return fail(opts, admission.reason)
  const model = aiModel('documentReader', process.env, admission.tier)
  if (!model) return fail(opts, 'ai_off')

  const bytes = await withStore(opts.db, opts.storeId, async (tx) =>
    (await documentStorage(tx, opts.storeId)).get(doc.fileKey),
  ).catch(() => null)
  if (!bytes) return fail(opts, 'file_missing')
  const isPdf = doc.mimeType === 'application/pdf'
  const text = isPdf ? await pdfText(bytes).catch(() => null) : ''
  if (text === null) return fail(opts, 'unreadable')

  const shape = shapeForKind(doc.kind)
  try {
    const { output, usage } = await generateStructured({
      runtime: {
        storeId: opts.storeId,
        userId: doc.uploadedBy ?? '',
        plan: admission.plan,
        feature: 'documentReader',
      },
      model,
      schema: DOCUMENT_SCHEMAS[shape] as z.ZodType<unknown>,
      instructions: documentReaderInstructions(shape),
      content: documentReaderContent({
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        bytes,
        text,
      }),
      abortSignal: opts.signal,
    })
    await withStore(opts.db, opts.storeId, async (tx) => {
      await recordAiUsage(ctx(tx), {
        month: admission.month,
        feature: 'documentReader',
        tier: admission.tier,
        ...usage,
      })
      await tx
        .update(purchaseDocument)
        .set({
          status: 'ready',
          extracted: { shape, data: output },
          rawText: text || null,
          error: null,
          updatedAt: new Date(),
        })
        .where(and(eq(purchaseDocument.id, doc.id), eq(purchaseDocument.status, 'reading')))
    })
  } catch {
    await fail(opts, 'model_failed')
  }
}
