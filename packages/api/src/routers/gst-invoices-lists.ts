/**
 * The GST invoices app's two lists, Queue and Invoices: search, filters, sort and paging, all on
 * the server (owner 23 Nov 2026). Split out of `./gst-invoices.ts`, which mounts them.
 */
import { permissions } from '@commerce/core'
import {
  buyerPlace,
  DOCUMENT_SORTS,
  defaultInvoiceDate,
  documentIds,
  listDocuments,
  PAYMENT_FILTERS,
  QUEUE_SORTS,
  QUEUE_VIEWS,
  queueDateKey,
  queuePage,
} from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { BULK_MAX, can } from '../procedures'
import { Gst, requireInstalled } from './gst-invoices-context'
import { Filter } from './gst-invoices-selection'

/** 10 / 25 / 50 / 100 rows, as the table's rows-per-page offers; 200 is one issue batch. */
const PerPage = z.number().int().min(1).max(200).default(25)
const Page = z.number().int().min(1).max(1000).default(1)

const QueueInput = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** Order number or customer name. */
  q: z.string().max(100).optional(),
  /** One GST number's drafts; omitted lists every GST number's. */
  gstRegistrationId: Gst,
  payment: z.enum(PAYMENT_FILTERS).optional(),
  /** Ready or Needs fixing; omitted is All. */
  view: z.enum(QUEUE_VIEWS).optional(),
  /** Omitted: date due, oldest first (the order a batch is numbered in). */
  sort: z.object({ by: z.enum(QUEUE_SORTS), desc: z.boolean() }).optional(),
  page: Page,
  perPage: PerPage,
})

/** One page of the Queue, with the counts of All, Ready and Needs fixing. */
export const queueList = can(permissions.ORDERS_READ)
  .input(QueueInput)
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    const { rows, total, counts } = await queuePage(context.tx, context.scope.storeId, input)
    return {
      total,
      counts,
      rows: rows.map(({ row: r, doc, status, fix, orderNumber }) => ({
        id: r.id,
        orderId: r.orderId,
        orderName: doc.order.name,
        orderNumber,
        placedAt: doc.order.placedAt,
        buyerName: r.buyerName,
        buyerPlace: buyerPlace(doc),
        /** What the invoice bills, for the Products column ("Glass mousepad × 1"). */
        items: doc.lines.map((l) => ({ title: l.description, quantity: l.quantity })),
        buyerGstin: r.buyerGstin,
        export: doc.exportSupply?.countryName ?? null,
        taxablePaise: r.taxablePaise,
        gstPaise: r.cgstPaise + r.sgstPaise + r.igstPaise,
        totalPaise: r.totalPaise,
        eligibleAt: r.eligibleAt,
        dispatchedAt: r.dispatchedAt,
        /** The Date sort as a number (due day, then order number), so the table agrees. */
        dateKey: queueDateKey({ dueAt: r.eligibleAt, orderNumber }),
        defaultDate: defaultInvoiceDate(r),
        /** Ready, Ready · B2B, Ready · Export, HSN missing, Buyer details missing. */
        status,
        /** Where the problem is fixed: a product's page or the order; null when ready. */
        fix,
      })),
    }
  })

/** One page of issued and cancelled documents, newest first unless sorted otherwise. */
export const documentList = can(permissions.ORDERS_READ)
  .input(
    Filter.extend({
      sort: z.object({ by: z.enum(DOCUMENT_SORTS), desc: z.boolean() }).optional(),
      page: Page,
      perPage: PerPage,
    }),
  )
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    const { page, perPage, ...filter } = input
    return listDocuments(context.tx, { ...filter, limit: perPage, offset: (page - 1) * perPage })
  })

/** Every id the Invoices filter matches (one bulk action's worth), for "Select all". */
export const documentListIds = can(permissions.ORDERS_READ)
  .input(Filter)
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    return documentIds(context.tx, input, BULK_MAX)
  })
