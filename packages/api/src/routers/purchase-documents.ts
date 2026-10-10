import {
  ApplyDocumentSchema,
  applyPurchaseDocument,
  deletePurchaseDocument,
  listPurchaseDocuments,
  PURCHASE_DOCUMENT_KINDS,
  PURCHASE_DOCUMENT_MAX_BYTES,
  permissions,
  purchaseDocumentFile,
  resetPurchaseDocument,
  uploadPurchaseDocument,
} from '@commerce/core'
import { z } from 'zod'
import { can, canDetached, heavy } from '../procedures'
import { checkAiAvailable } from '../services/ai/guard'
import { purchaseDocumentReview, startDocumentRead } from '../services/purchase-documents.service'
import { friendly } from './inventory'

const byId = z.object({ id: z.uuid() })

/** Exactly one of the two: the order or the shipment the document belongs to. */
const Owner = z.union([
  z.object({ purchaseOrderId: z.uuid() }),
  z.object({ inboundShipmentId: z.uuid() }),
])

/**
 * Supplier and import documents on purchase orders and inbound shipments: upload (private),
 * read with AI in the worker, review, and apply what the merchant ticks in one transaction.
 */
export const purchaseDocumentsRouter = {
  list: can(permissions.INVENTORY_READ)
    .input(Owner)
    .handler(({ context, input }) => listPurchaseDocuments(context.tx, input)),

  upload: can(permissions.INVENTORY_WRITE)
    .input(
      z
        .object({
          purchaseOrderId: z.uuid().optional(),
          inboundShipmentId: z.uuid().optional(),
          kind: z.enum(PURCHASE_DOCUMENT_KINDS),
          file: z
            .instanceof(File)
            .refine(
              (f) => f.size > 0 && f.size <= PURCHASE_DOCUMENT_MAX_BYTES,
              'Upload a file under 15 MB',
            ),
        })
        .refine((d) => (d.purchaseOrderId ? 1 : 0) + (d.inboundShipmentId ? 1 : 0) === 1, {
          message: 'A document belongs to one purchase order or one inbound shipment',
        }),
    )
    .handler(({ context, input }) =>
      friendly(async () => {
        const owner = input.purchaseOrderId
          ? { purchaseOrderId: input.purchaseOrderId }
          : { inboundShipmentId: input.inboundShipmentId as string }
        const row = await uploadPurchaseDocument(context.tx, context.scope.storeId, {
          owner,
          kind: input.kind,
          file: {
            name: input.file.name,
            type: input.file.type,
            bytes: new Uint8Array(await input.file.arrayBuffer()),
          },
          userId: context.scope.userId,
        })
        return { id: row.id, status: row.status }
      }),
    ),

  /** What the AI read, the order lines it can change and the proposed matches. No writes. */
  review: can(permissions.INVENTORY_READ)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(() => purchaseDocumentReview(context.tx, context.scope.storeId, input.id)),
    ),

  /** The file itself, for the preview and the download button. Never a public link. */
  download: can(permissions.INVENTORY_READ)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(async () => {
        const f = await purchaseDocumentFile(context.tx, context.scope.storeId, input.id)
        return new File([f.bytes as Uint8Array<ArrayBuffer>], f.name, { type: f.type })
      }),
    ),

  delete: can(permissions.INVENTORY_WRITE)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(() => deletePurchaseDocument(context.tx, context.scope.storeId, input.id)),
    ),

  /** Read (or read again) with AI, in the worker. Counts against the store's AI allowance. */
  read: canDetached(permissions.INVENTORY_WRITE)
    .use(heavy('documentRead'))
    .input(byId)
    .handler(async ({ context, input }) => {
      await checkAiAvailable(context)
      return friendly(() => startDocumentRead(context, input.id))
    }),

  /** Apply what the merchant ticked on the review screen. Once per document. */
  apply: can(permissions.INVENTORY_WRITE)
    .input(ApplyDocumentSchema)
    .handler(({ context, input }) =>
      friendly(() =>
        applyPurchaseDocument(context.tx, context.scope.storeId, input, context.scope.userId),
      ),
    ),

  /** Allow an applied document to be applied again. Undoes nothing. */
  reset: can(permissions.INVENTORY_WRITE)
    .input(byId)
    .handler(({ context, input }) =>
      friendly(() => resetPurchaseDocument(context.tx, context.scope.storeId, input.id)),
    ),
}
