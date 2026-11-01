import { order, orderLine, product, type StoreTx, store, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { requestLinkToken } from './tokens'

/** What a review QR card opens: one product's review form, or each product of one order. */
export type QrTarget = { kind: 'product' | 'order'; id: string }

export type QrLink = { productId: string; title: string; url: string }

/**
 * The storefront link a QR card encodes: the product page, scrolled to the reviews, with the
 * review form opened. A request token (an order's card) signs the shopper in as the buyer, so
 * the review gets the verified badge without an account.
 */
export function reviewPageUrl(base: string, handle: string, token?: string | null): string {
  const params = token ? `review=${token}` : 'write=1'
  return `${base.replace(/\/+$/, '')}/products/${encodeURIComponent(handle)}?${params}#reviews`
}

/** `order-<uuid>` / `product-<uuid>` (the admin page's path) as a target; null when malformed. */
export function parseQrTarget(raw: string): QrTarget | null {
  const m = /^(order|product)-([0-9a-f-]{36})$/i.exec(raw)
  return m ? { kind: m[1] as QrTarget['kind'], id: (m[2] as string).toLowerCase() } : null
}

/**
 * The links for a QR card: the product's own (anyone may open it; the store's "who can review"
 * rule still applies), or one signed link per product of the order (gift cards left out), so
 * a card packed in the parcel lets the buyer review as a verified buyer. Empty when the product
 * or order is not this store's.
 */
export async function reviewQrLinks(
  tx: StoreTx,
  storeId: string,
  target: QrTarget,
  opts: { secret: string; storefrontUrl: string },
): Promise<{ storeName: string; orderNumber: number | null; links: QrLink[] }> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  const storeName = s?.name ?? ''
  if (target.kind === 'product') {
    const [p] = await tx
      .select({ id: product.id, title: product.title, handle: product.handle })
      .from(product)
      .where(eq(product.id, target.id))
    return {
      storeName,
      orderNumber: null,
      links: p
        ? [{ productId: p.id, title: p.title, url: reviewPageUrl(opts.storefrontUrl, p.handle) }]
        : [],
    }
  }
  const [o] = await tx.select({ number: order.number }).from(order).where(eq(order.id, target.id))
  if (!o) return { storeName, orderNumber: null, links: [] }
  const rows = await tx
    .selectDistinct({ id: product.id, title: product.title, handle: product.handle })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(orderLine.orderId, target.id), eq(orderLine.giftCard, false)))
  return {
    storeName,
    orderNumber: o.number,
    links: rows.map((p) => ({
      productId: p.id,
      title: p.title,
      url: reviewPageUrl(
        opts.storefrontUrl,
        p.handle,
        requestLinkToken(opts.secret, { storeId, orderId: target.id, productId: p.id }),
      ),
    })),
  }
}
