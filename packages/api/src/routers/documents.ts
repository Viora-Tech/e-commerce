import {
  DOCUMENT_KINDS,
  DocumentTemplateWriteSchema,
  documentStore,
  getDocumentTemplate,
  gstInvoicesInstalled,
  listDocumentTemplates,
  permissions,
  resetDocumentTemplate,
  saveDocumentTemplate,
} from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'

const KindInput = z.object({ kind: z.enum(DOCUMENT_KINDS) })

/**
 * Settings › Templates (audit #164): the Packing slip, Pick list and Invoice templates the orders
 * print with, and the store header they show. Reading is for anyone who prints orders.
 */
export const documentsRouter = {
  /** Every template (the merchant's or the default), the store header, and whether the GST app owns invoices. */
  templates: can(permissions.ORDERS_READ).handler(async ({ context }) => {
    const [templates, store, gstApp] = await Promise.all([
      listDocumentTemplates(context.tx),
      documentStore(context.tx, context.scope.storeId),
      gstInvoicesInstalled(context.tx, context.scope.storeId),
    ])
    return { templates, store, gstApp }
  }),

  get: can(permissions.ORDERS_READ)
    .input(KindInput)
    .handler(({ context, input }) => getDocumentTemplate(context.tx, input.kind)),

  save: can(permissions.SETTINGS_MANAGE)
    .input(DocumentTemplateWriteSchema)
    .handler(({ context, input }) =>
      saveDocumentTemplate(context.tx, context.scope.storeId, input),
    ),

  reset: can(permissions.SETTINGS_MANAGE)
    .input(KindInput)
    .handler(({ context, input }) => resetDocumentTemplate(context.tx, input.kind)),
}
