import { documentLinkPath } from '@commerce/invoices/link'
import type { OrderLink, OrderLinkContext } from '@commerce/plugins'
import { and, eq, inArray } from 'drizzle-orm'
import { loadSettings } from './issue'
import { invoice } from './schema'

const LABELS = { tax_invoice: 'Download invoice', credit_note: 'Download credit note' } as const

/** Signed, expiring download links for the order's invoice and credit notes. */
export async function orderLinks(ctx: OrderLinkContext, orderId: string): Promise<OrderLink[]> {
  const { settings, rows } = await ctx.inStore(async (tx) => ({
    settings: await loadSettings(tx, ctx.storeId),
    rows: await tx
      .select({ id: invoice.id, kind: invoice.kind, number: invoice.number })
      .from(invoice)
      .where(
        and(eq(invoice.orderId, orderId), inArray(invoice.kind, ['tax_invoice', 'credit_note'])),
      )
      .orderBy(invoice.issuedAt),
  }))
  const on = ctx.surface === 'email' ? settings.emailLink : settings.storefrontLink
  // Emails need an absolute URL; the order page can link relative to its own host.
  if (!on || (ctx.surface === 'email' && !ctx.storefrontUrl)) return []
  const base = ctx.surface === 'email' ? (ctx.storefrontUrl ?? '') : ''
  return rows.map((r) => ({
    label: `${LABELS[r.kind as keyof typeof LABELS]} ${r.number ?? ''}`.trim(),
    url: `${base}${documentLinkPath(ctx.settingsSecret, {
      storeId: ctx.storeId,
      documentId: r.id,
    })}`,
  }))
}
