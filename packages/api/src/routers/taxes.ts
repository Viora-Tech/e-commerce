import { GstRegistrationError, permissions } from '@commerce/core'
import { InvoiceError } from '@commerce/plugin-gst-invoices/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getTaxes, saveTaxes, TaxesError, TaxesInputSchema } from '../services/taxes.service'

/** Settings › Taxes & GST: GSTIN, how GST is charged, and invoice numbering. */
export const taxesRouter = {
  get: can(permissions.SETTINGS_READ).handler(async ({ context }) =>
    getTaxes(context.tx, context.scope.storeId),
  ),

  save: can(permissions.SETTINGS_MANAGE)
    .input(TaxesInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await saveTaxes(context.tx, context.scope.storeId, input)
      } catch (err) {
        if (
          err instanceof TaxesError ||
          err instanceof InvoiceError ||
          err instanceof GstRegistrationError
        ) {
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        }
        if (err instanceof z.ZodError) {
          throw new ORPCError('BAD_REQUEST', { message: err.issues[0]?.message ?? 'Invalid' })
        }
        throw err
      }
    }),
}
