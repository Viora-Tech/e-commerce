/**
 * "Already invoiced" on the GST invoices Queue: record the tax invoice a queued order already got
 * outside Koomerce (by hand or in a previous billing system) under its own number and date, or
 * without them for old orders whose details are gone (`recordExternalMany` for many rows).
 * Mounted on `gstInvoices.queue.recordExternal` from `./gst-invoices.ts`. No PDF is drawn, so
 * nothing goes to the render worker. `gstInvoices.queue.undoExternal` puts a recorded invoice
 * back in the queue (a typo), while its month is not filed.
 */
import { permissions } from '@commerce/core'
import {
  RECORD_MANY_MAX,
  recordAlreadyInvoiced,
  recordManyWithoutDetails,
  undoExternalInvoice,
} from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { can } from '../procedures'
import { asOrpc, queueChanged, requireInstalled } from './gst-invoices-context'

export const recordExternal = can(permissions.ORDERS_WRITE)
  .input(
    z.object({
      /** The queued draft (a Queue row). */
      id: z.uuid(),
      /**
       * The invoice number as it was issued; checked against GST's 16 characters. Leave it and
       * the date out when the merchant no longer has them (counted in no Koomerce return).
       */
      number: z.string().trim().max(40).optional(),
      /** The date printed on that invoice; it decides the return month. Both or neither. */
      invoiceDate: z.coerce.date().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    queueChanged(context)
    try {
      const row = await recordAlreadyInvoiced(
        context.tx,
        context.scope.storeId,
        input.id,
        { number: input.number, invoiceDate: input.invoiceDate },
        { author: context.session.user.email },
      )
      return { id: row.id, number: row.number ?? '' }
    } catch (err) {
      asOrpc(err)
    }
  })

/**
 * Bulk "Mark as already invoiced" on ticked Queue rows, without invoice details (old orders
 * invoiced in a previous system); rows that cannot be recorded are skipped with their reason.
 */
export const recordExternalMany = can(permissions.ORDERS_WRITE)
  .input(z.object({ ids: z.array(z.uuid()).min(1).max(RECORD_MANY_MAX) }))
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    queueChanged(context)
    try {
      return await recordManyWithoutDetails(context.tx, context.scope.storeId, input.ids, {
        author: context.session.user.email,
      })
    } catch (err) {
      asOrpc(err)
    }
  })

/** Undo "Already invoiced": the recorded invoice becomes a queued draft again. */
export const undoExternal = can(permissions.ORDERS_WRITE)
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    queueChanged(context)
    try {
      const row = await undoExternalInvoice(context.tx, context.scope.storeId, input.id, {
        author: context.session.user.email,
      })
      return { id: row.id }
    } catch (err) {
      asOrpc(err)
    }
  })
