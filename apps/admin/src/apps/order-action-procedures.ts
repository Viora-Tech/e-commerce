/**
 * The calls behind apps' `procedure` order actions, keyed by the manifest's `handler.procedure`
 * (`<pluginId>/<name>`). Each runs an existing API procedure for the chosen orders and answers
 * with the toast to show, and the buttons on it. A manifest key with no entry here is never
 * offered, the same way an app page without a registered component is not routed (`./registry`).
 */
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import type { orderAppActionsContent } from '@/data/order-app-actions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Copy = typeof orderAppActionsContent

/** A button on the result toast: `href` opens an admin page, `run` does anything else. */
export type OrderActionButton = { label: string; href?: string; run?: () => Promise<void> }

export type OrderActionResult = {
  message: string
  action?: OrderActionButton | undefined
  secondary?: OrderActionButton | undefined
}

export type OrderActionProcedure = (
  orderIds: readonly string[],
  copy: Copy,
) => Promise<OrderActionResult>

/** `gstInvoices.queue.add` takes at most this many orders a call. */
const QUEUE_BATCH = 100

/**
 * Fired on `window` after a GST action changed an order's invoices, so the order page's
 * Invoices card reloads (it is a client card; `router.refresh()` does not remount it).
 */
export const GST_INVOICES_CHANGED = 'gst-invoices:changed'

const announce = () => window.dispatchEvent(new Event(GST_INVOICES_CHANGED))

/** The issued invoice's PDF: open it in a tab (View) or save it (Download). */
const pdf = (id: string, mode: 'open' | 'download') => async () =>
  saveFile(await api.gstInvoices.download({ id }), mode)

const GST_APP = 'gst-invoices'

export const ORDER_ACTION_PROCEDURES: Record<string, OrderActionProcedure> = {
  'gst-invoices/generate': async (orderIds, copy) => {
    const issued: string[] = []
    const already: string[] = []
    const invoices: { id: string; number: string }[] = []
    for (const orderId of orderIds) {
      const r = await api.gstInvoices.generate({ orderId })
      issued.push(...r.issued)
      already.push(...r.alreadyIssued)
      invoices.push(...(r.invoices ?? []))
    }
    announce()
    const message = issued.length
      ? copy.gst.issued(issued)
      : already.length
        ? copy.gst.alreadyIssued(already)
        : copy.gst.nothingIssued
    const [only] = invoices
    // One invoice: View and Download on the toast. A split order's several: the order's card.
    if (invoices.length === 1 && only) {
      return {
        message,
        action: { label: copy.gst.download, run: pdf(only.id, 'download') },
        secondary: { label: copy.gst.view, run: pdf(only.id, 'open') },
      }
    }
    const [first] = orderIds
    if (invoices.length > 1 && first) {
      return {
        message,
        action: { label: copy.gst.viewAll, href: `${routes.orders.detail(first)}#order-invoices` },
      }
    }
    return { message }
  },
  'gst-invoices/queue-add': async (orderIds, copy) => {
    const counts = { added: 0, skipped: 0, alreadyQueued: 0, alreadyInvoiced: 0 }
    for (let i = 0; i < orderIds.length; i += QUEUE_BATCH) {
      const r = await api.gstInvoices.queue.add({
        orderIds: orderIds.slice(i, i + QUEUE_BATCH),
        skipIneligible: true,
      })
      counts.added += r?.added ?? 0
      counts.skipped += r?.skipped ?? 0
      counts.alreadyQueued += r?.alreadyQueued ?? 0
      counts.alreadyInvoiced += r?.alreadyInvoiced ?? 0
    }
    announce()
    return {
      message: copy.gst.queued(counts),
      // Queued invoices are issued from the queue (or straight away, when the store auto-issues).
      action:
        counts.added || counts.alreadyQueued
          ? { label: copy.gst.openQueue, href: routes.apps.page(GST_APP) }
          : undefined,
    }
  },
}

/** Whether the admin can run an action: links and Create shipment always; a procedure when registered. */
export const isRunnable = (handler: { type: string; procedure?: string }) =>
  handler.type !== 'procedure' ||
  Boolean(handler.procedure && handler.procedure in ORDER_ACTION_PROCEDURES)
