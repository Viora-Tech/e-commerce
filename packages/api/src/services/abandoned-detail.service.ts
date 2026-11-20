import { convertedToSale, recoveryUrl, storefrontOriginFor } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  cart,
  cartLine,
  media,
  notification,
  order,
  product,
  productMedia,
  variant,
} from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { and, asc, desc, eq, ne, or, sql } from 'drizzle-orm'

/**
 * One abandoned checkout for its detail page (Figma "Abandoned checkout · Polish", 18 Nov): the
 * contact and how many orders they placed before, each line with its photo, price and SKU, the
 * reminders that went out (channel, address, when) and a fresh signed recovery link. Kept out of
 * draft.service.ts, which is at the 500-line cap.
 */
export async function getStoreAbandoned(
  tx: StoreTx,
  storeId: string,
  cartId: string,
  link: { settingsSecret: string; storefrontUrl: string },
) {
  const [found] = await tx
    .select({ row: cart, recovered: convertedToSale })
    .from(cart)
    .where(eq(cart.id, cartId))
  if (!found) throw new ORPCError('NOT_FOUND', { message: 'Checkout not found' })
  const { row, recovered } = found
  const lines = await tx
    .select({
      id: cartLine.id,
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
      productTitle: product.title,
      variantTitle: variant.title,
      sku: variant.sku,
      image: sql<string | null>`coalesce(${media.url}, (
        select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
        where pm.product_id = ${variant.productId} order by pm.position limit 1))`,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(cartLine.cartId, cartId))
    .orderBy(asc(cartLine.id))
  // One row per channel (unique on cart, channel, template); newest first.
  const reminders = await tx
    .select({
      channel: notification.channel,
      to: notification.to,
      status: notification.status,
      at: notification.createdAt,
    })
    .from(notification)
    .where(and(eq(notification.cartId, cartId), eq(notification.template, 'checkout_recovery')))
    .orderBy(desc(notification.createdAt))
  const ordersCount = await priorOrders(tx, row)
  const origin = await storefrontOriginFor(tx, storeId, link.storefrontUrl)
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    customerName: row.customerName,
    discountCode: row.discountCode,
    attribution: row.attribution ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    recoverySentAt: row.recoverySentAt,
    recovered,
    reminders,
    /** Placed orders (not drafts) by the same customer, email or phone: "No orders yet". */
    ordersCount,
    lines: lines.map((l) => ({ ...l, totalPaise: l.quantity * l.unitPricePaise })),
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: lines.reduce((n, l) => n + l.quantity * l.unitPricePaise, 0),
    /** Not offered for a cart that already became an order: the link would show an empty basket. */
    recoveryUrl: recovered ? null : recoveryUrl(row.id, link.settingsSecret, origin),
  }
}

/** Orders the shopper placed in this store, matched by customer, email or phone. */
async function priorOrders(
  tx: StoreTx,
  row: { customerId: string | null; email: string | null; phone: string | null },
): Promise<number> {
  const who = [
    row.customerId ? eq(order.customerId, row.customerId) : null,
    row.email ? sql`lower(${order.email}) = lower(${row.email})` : null,
    row.phone ? eq(order.phone, row.phone) : null,
  ].filter((c) => c !== null)
  if (who.length === 0) return 0
  const [r] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(order)
    .where(and(ne(order.status, 'draft'), eq(order.isTest, false), or(...who)))
  return r?.n ?? 0
}
