/**
 * The calls behind apps' `procedure` order actions, keyed by the manifest's `handler.procedure`
 * (`<pluginId>/<name>`). Each runs an existing API procedure for the chosen orders and answers
 * with the toast to show. A manifest key with no entry here is never offered, the same way an
 * app page without a registered component is not routed (`./registry`).
 */
import type { orderAppActionsContent } from '@/data/order-app-actions'
import { api } from '@/lib/api-client'

type Copy = typeof orderAppActionsContent

export type OrderActionProcedure = (orderIds: readonly string[], copy: Copy) => Promise<string>

/** `gstInvoices.queue.add` takes at most this many orders a call. */
const QUEUE_BATCH = 100

export const ORDER_ACTION_PROCEDURES: Record<string, OrderActionProcedure> = {
  'gst-invoices/generate': async (orderIds, copy) => {
    const issued: string[] = []
    const already: string[] = []
    for (const orderId of orderIds) {
      const r = await api.gstInvoices.generate({ orderId })
      issued.push(...r.issued)
      already.push(...r.alreadyIssued)
    }
    if (issued.length) return copy.gst.issued(issued)
    return already.length ? copy.gst.alreadyIssued(already) : copy.gst.nothingIssued
  },
  'gst-invoices/queue-add': async (orderIds, copy) => {
    let added = 0
    let skipped = 0
    for (let i = 0; i < orderIds.length; i += QUEUE_BATCH) {
      const r = await api.gstInvoices.queue.add({
        orderIds: orderIds.slice(i, i + QUEUE_BATCH),
        skipIneligible: true,
      })
      added += r?.added ?? 0
      skipped += r?.skipped ?? 0
    }
    return copy.gst.queued(added, skipped)
  },
}

/** Whether the admin can run an action: links and Create shipment always; a procedure when registered. */
export const isRunnable = (handler: { type: string; procedure?: string }) =>
  handler.type !== 'procedure' ||
  Boolean(handler.procedure && handler.procedure in ORDER_ACTION_PROCEDURES)
