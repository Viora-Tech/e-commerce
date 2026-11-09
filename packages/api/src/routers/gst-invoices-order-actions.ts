/**
 * The GST invoices procedures behind its order actions (developer docs, Plugins, "Order
 * actions"): adding orders to the invoice queue and "Generate GST invoice". Split out of
 * `./gst-invoices.ts`, which mounts them as `gstInvoices.queue.add` and `gstInvoices.generate`.
 */
import { enqueueAppJob, permissions } from '@commerce/core'
import {
  defaultInvoiceDate,
  enqueueOrderParcels,
  GST_INVOICES_ID,
  isCancelledOrder,
  issueDrafts,
  issuedInvoiceIds,
  isTestOrder,
  refreshInvoiceGst as refreshFromProducts,
  renderAndStore,
  soldOnlyGiftCards,
} from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { BULK_MAX, can } from '../procedures'
import { orderIdsByNumber } from '../services/gst-invoices.service'
import { asOrpc, renderDeps, requireInstalled } from './gst-invoices-context'

/** Add orders by hand, e.g. a pre-order the merchant wants invoiced now. */
export const addToQueue = can(permissions.ORDERS_WRITE)
  .input(
    z.object({
      orderIds: z.array(z.uuid()).max(100).default([]),
      orderNumbers: z.array(z.number().int().positive()).max(100).default([]),
      /**
       * The Orders list's bulk "Add to invoice queue": skip test-mode, cancelled and
       * gift-card-only orders (which never get a tax invoice) and count them, instead of
       * failing the batch.
       */
      skipIneligible: z.boolean().default(false),
    }),
  )
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    try {
      const byNumber = await orderIdsByNumber(context.tx, input.orderNumbers)
      let added = 0
      let skipped = 0
      /* Orders that added nothing because their invoice was already there (queued by payment
         or fulfilment, or issued): counted, so the toast accounts for every order selected. */
      let alreadyQueued = 0
      let alreadyInvoiced = 0
      for (const orderId of [...input.orderIds, ...byNumber.ids]) {
        if (
          input.skipIneligible &&
          ((await isTestOrder(context.tx, orderId)) ||
            (await isCancelledOrder(context.tx, orderId)) ||
            (await soldOnlyGiftCards(context.tx, orderId)))
        ) {
          skipped += 1
          continue
        }
        const queued = await enqueueOrderParcels(
          context.tx,
          context.scope.storeId,
          orderId,
          'manual',
        )
        // One draft per parcel; a split order adds one per GSTIN.
        const created = queued.filter((q) => q.created).length
        added += created
        if (created === 0 && queued.length > 0) {
          if (queued.every((q) => q.row.status === 'issued')) alreadyInvoiced += 1
          else alreadyQueued += 1
        }
      }
      return { added, skipped, alreadyQueued, alreadyInvoiced, missing: byNumber.missing }
    } catch (err) {
      asOrpc(err)
    }
  })

/**
 * "Generate GST invoice" (the order's More actions and row menu): queue the order's tax invoice
 * (one per parcel) and issue it straight away, dated when the goods left or today. An order
 * already invoiced returns its numbers; a test order is refused, as in the queue.
 */
export const generateInvoice = can(permissions.ORDERS_WRITE)
  .input(z.object({ orderId: z.uuid() }))
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    try {
      const queued = await enqueueOrderParcels(
        context.tx,
        context.scope.storeId,
        input.orderId,
        'manual',
      )
      const drafts = queued.filter((q) => q.row.status === 'draft')
      const alreadyIssued = queued.flatMap((q) =>
        q.row.status === 'issued' && q.row.number ? [q.row.number] : [],
      )
      const plan = drafts.length
        ? await issueDrafts(
            context.tx,
            context.scope.storeId,
            drafts.map((q) => ({ id: q.row.id, invoiceDate: defaultInvoiceDate(q.row) })),
            { commit: true },
          )
        : []
      // PDFs render in the worker, as for a queue batch.
      if (context.appJobs) {
        for (const p of plan) {
          await enqueueAppJob(
            context.appJobs,
            {
              storeId: context.scope.storeId,
              pluginId: GST_INVOICES_ID,
              name: 'render',
              data: { invoiceId: p.id },
            },
            `render:${p.id}`,
          )
        }
      }
      // Ids too, so the admin's toast can open or download what was issued (issue 1009).
      const invoices = [
        ...queued.flatMap((q) =>
          q.row.status === 'issued' && q.row.number ? [{ id: q.row.id, number: q.row.number }] : [],
        ),
        ...plan.map((p) => ({ id: p.id, number: p.number })),
      ]
      return { issued: plan.map((p) => p.number), alreadyIssued, invoices }
    } catch (err) {
      asOrpc(err)
    }
  })

/** The issued tax invoices of the orders selected in Orders, for its bulk Print invoices. */
const invoicesForOrders = can(permissions.ORDERS_READ)
  .input(z.object({ orderIds: z.array(z.uuid()).min(1).max(BULK_MAX) }))
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    return { ids: await issuedInvoiceIds(context.tx, input.orderIds) }
  })

/**
 * "Recalculate GST from products" on an issued, unfiled tax invoice: the order's lines take
 * their products' GST and HSN as they are now, and the invoice is rebuilt under the same
 * number and date. Once reported in GSTR-1 it is locked; a credit note is the way then.
 */
const refreshInvoiceGst = can(permissions.ORDERS_WRITE)
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    try {
      const { row, changedLines } = await refreshFromProducts(
        context.tx,
        context.scope.storeId,
        input.id,
      )
      const done = await renderAndStore(renderDeps(context), row.id)
      return { id: done.id, number: done.number, changedLines }
    } catch (err) {
      asOrpc(err)
    }
  })

/** Mounted on `gstInvoices` in one line, so that router stays within the file-size sweep. */
export const invoiceFixProcedures = { forOrders: invoicesForOrders, refreshGst: refreshInvoiceGst }
