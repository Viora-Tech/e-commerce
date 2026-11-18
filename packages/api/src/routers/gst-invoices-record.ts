/**
 * "Already invoiced" on the GST invoices Queue: record the tax invoice a queued order already got
 * outside Koomerce (by hand or in a previous billing system) under its own number and date.
 * Mounted on `gstInvoices.queue.recordExternal` from `./gst-invoices.ts`. No PDF is drawn, so
 * nothing goes to the render worker.
 */
import { permissions } from '@commerce/core'
import { recordExternalInvoice } from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { can } from '../procedures'
import { asOrpc, requireInstalled } from './gst-invoices-context'

export const recordExternal = can(permissions.ORDERS_WRITE)
  .input(
    z.object({
      /** The queued draft (a Queue row). */
      id: z.uuid(),
      /** The invoice number as it was issued; checked against GST's 16 characters. */
      number: z.string().trim().min(1).max(40),
      /** The date printed on that invoice; it decides the return month. */
      invoiceDate: z.coerce.date(),
    }),
  )
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    try {
      const row = await recordExternalInvoice(context.tx, context.scope.storeId, input.id, {
        number: input.number,
        invoiceDate: input.invoiceDate,
      })
      return { id: row.id, number: row.number ?? '' }
    } catch (err) {
      asOrpc(err)
    }
  })
