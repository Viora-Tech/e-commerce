import { documentLinkPath, orderInvoiceLinkPath } from '@commerce/invoices/link'
import type { OrderLink, OrderLinkContext } from '@commerce/plugins'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { loadSettings } from './issue'
import { isPreorder } from './queue'
import { invoice } from './schema'

const LABELS = { tax_invoice: 'Download invoice', credit_note: 'Download credit note' } as const

type Settings = Awaited<ReturnType<typeof loadSettings>>

/**
 * Whether the payment email should promise an invoice not issued yet: the app issues it after
 * hearing `order.paid`, which comes after the email is queued. Only when the store invoices on
 * payment (a pre-order waits for dispatch unless the store invoices those at payment too).
 */
async function invoiceComesWithPayment(
  ctx: OrderLinkContext,
  settings: Settings,
  orderId: string,
): Promise<boolean> {
  if (ctx.template !== 'payment_received') return false
  if (!settings.documents.tax_invoice.enabled || settings.issueOn !== 'payment') return false
  if (settings.preorderInvoiceAtPayment) return true
  return !(await ctx.inStore((tx) => isPreorder(tx, orderId, settings.preorderTag)))
}

/**
 * Signed, expiring download links for the order's invoice and credit notes. A payment email sent
 * before the invoice exists gets one order-wide "Download invoice" link instead; its page finds
 * the invoice when the shopper opens it (storefront `documents/order/[orderId]`).
 */
export async function orderLinks(ctx: OrderLinkContext, orderId: string): Promise<OrderLink[]> {
  const { settings, rows } = await ctx.inStore(async (tx) => ({
    settings: await loadSettings(tx, ctx.storeId),
    rows: await tx
      .select({ id: invoice.id, kind: invoice.kind, number: invoice.number })
      .from(invoice)
      .where(
        and(
          eq(invoice.orderId, orderId),
          inArray(invoice.kind, ['tax_invoice', 'credit_note']),
          // A draft is not a document yet and a cancelled one is void: only issued ones are offered.
          eq(invoice.status, 'issued'),
          // Recorded, invoiced outside Koomerce: no PDF of ours to link to.
          ne(invoice.source, 'external'),
        ),
      )
      .orderBy(invoice.issuedAt),
  }))
  const on = ctx.surface === 'email' ? settings.emailLink : settings.storefrontLink
  // Emails need an absolute URL; the order page can link relative to its own host.
  if (!on || (ctx.surface === 'email' && !ctx.storefrontUrl)) return []
  const base = ctx.surface === 'email' ? (ctx.storefrontUrl ?? '') : ''
  const links: OrderLink[] = rows.map((r) => ({
    label: `${LABELS[r.kind as keyof typeof LABELS]} ${r.number ?? ''}`.trim(),
    url: `${base}${documentLinkPath(ctx.settingsSecret, {
      storeId: ctx.storeId,
      documentId: r.id,
    })}`,
    ...(r.kind === 'tax_invoice' ? { kind: 'invoice' as const } : {}),
  }))
  const hasInvoice = rows.some((r) => r.kind === 'tax_invoice')
  if (
    ctx.surface === 'email' &&
    !hasInvoice &&
    (await invoiceComesWithPayment(ctx, settings, orderId))
  ) {
    links.unshift({
      kind: 'invoice',
      label: LABELS.tax_invoice,
      url: `${base}${orderInvoiceLinkPath(ctx.settingsSecret, { storeId: ctx.storeId, orderId })}`,
    })
  }
  return links
}
