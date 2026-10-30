/**
 * SOURCE OF TRUTH: browse abandonment — WHAT: records a known shopper's product views (from the
 * storefront page-view beacon) and lists the views due for a "Browse abandoned" nudge: quiet for
 * the workflow's wait, within a week, product not added to a cart or bought since, shopper with
 * marketing consent, no run for the same shopper and product in the last 7 days / WHY: audit
 * #183; the legacy Growth runner (`enrolDue`) and the Automations engine sweep (`growthSweep`)
 * read the same list, so both enrol the same shoppers. Server-only.
 */
import { cart, customer, product, productView, type StoreTx, variant } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { and, eq, or, type SQL, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { decryptCustomerPhone, phoneBlindIndex } from '../customers/phone-crypto'
import { BROWSE_VIEW_THROTTLE_MINUTES, browseRepeatSince, browseWindow } from './browse-rules'
import type { MergeValues } from './email'

const SWEEP_LIMIT = 200

/**
 * The customer a basket's contact belongs to: the signed-in customer on it, else a customer
 * with the email or phone typed at checkout. Null for a basket nobody is known by.
 */
async function customerOfCart(tx: StoreTx, cartId: string, secret: string): Promise<string | null> {
  const [c] = await tx
    .select({ customerId: cart.customerId, email: cart.email, phone: cart.phone })
    .from(cart)
    .where(eq(cart.id, cartId))
  if (!c) return null
  if (c.customerId) return c.customerId
  const email = c.email?.trim().toLowerCase()
  const digits = c.phone?.replace(/\D/g, '') ?? ''
  const phoneIndexes = digits
    ? [...new Set([digits, digits.slice(-10)])].map((p) => phoneBlindIndex(p, secret))
    : []
  const who = [
    email ? eq(customer.email, email) : null,
    ...phoneIndexes.map((i) => eq(customer.phoneIndex, i)),
  ].filter((x): x is NonNullable<typeof x> => x !== null)
  if (who.length === 0) return null
  const [cu] = await tx
    .select({ id: customer.id })
    .from(customer)
    .where(or(...who))
    .limit(1)
  return cu?.id ?? null
}

/**
 * One product page view by a known shopper: the signed-in customer, or the customer the basket's
 * checkout contact belongs to. Anonymous views are not kept. A repeat view within a few minutes
 * writes nothing. Returns whether a view was recorded.
 */
export async function recordProductView(
  ctx: StoreContext,
  input: {
    customerId: string | null
    cartId: string | null
    handle: string
    secret: string
    now?: Date | undefined
  },
): Promise<boolean> {
  const now = input.now ?? new Date()
  const customerId =
    input.customerId ??
    (input.cartId ? await customerOfCart(ctx.tx, input.cartId, input.secret) : null)
  if (!customerId) return false
  const [p] = await ctx.tx
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.handle, input.handle), eq(product.status, 'active')))
    .limit(1)
  if (!p) return false
  const throttle = new Date(now.getTime() - BROWSE_VIEW_THROTTLE_MINUTES * 60_000)
  const rows = await ctx.tx
    .insert(productView)
    .values({ storeId: ctx.storeId, customerId, productId: p.id, viewedAt: now })
    .onConflictDoUpdate({
      target: [productView.storeId, productView.customerId, productView.productId],
      set: { viewedAt: now },
      setWhere: sql`${productView.viewedAt} < ${throttle.toISOString()}::timestamptz`,
    })
    .returning({ id: productView.id })
  return rows.length > 0
}

/** A view due for a nudge, with the shopper's contact. */
export type DueBrowseView = {
  customerId: string
  productId: string
  viewedAt: Date
  email: string | null
  phone: string | null
  name: string | null
}

/**
 * Views due for the "Browse abandoned" nudge of one automation (legacy) or workflow (engine):
 * viewed between a week ago and `afterMinutes` ago, the product still active and not in any of
 * the shopper's baskets touched since a week ago nor in an order since the view, and the shopper
 * with consent on email or WhatsApp. `ran` filters out shoppers already nudged about the same
 * product in the last 7 days by this automation: a SQL condition on `trigger_key` (the caller's
 * run table), with `browse:<customer>:<product>:` as the key's start.
 */
export async function dueBrowseViews(
  tx: StoreTx,
  opts: {
    afterMinutes: number
    now: Date
    secret: string
    /** Whether a run of this automation already exists for the key prefix since the date. */
    ran: (keyPrefix: SQL, since: Date) => SQL
  },
): Promise<DueBrowseView[]> {
  const { from, to } = browseWindow(opts.now, opts.afterMinutes)
  const prefix = sql`'browse:' || ${productView.customerId}::text || ':' || ${productView.productId}::text || ':'`
  const rows = await tx
    .select({
      customerId: productView.customerId,
      productId: productView.productId,
      viewedAt: productView.viewedAt,
      email: customer.email,
      phone: customer.phone,
      name: customer.name,
    })
    .from(productView)
    .innerJoin(customer, eq(customer.id, productView.customerId))
    .innerJoin(product, eq(product.id, productView.productId))
    .where(
      and(
        sql`${productView.viewedAt} > ${from.toISOString()}::timestamptz`,
        sql`${productView.viewedAt} <= ${to.toISOString()}::timestamptz`,
        eq(product.status, 'active'),
        sql`${customer.unsubscribedAt} is null and ${customer.anonymisedAt} is null`,
        sql`(${customer.acceptsMarketing} or ${customer.acceptsWhatsapp})`,
        // Added to a basket: the cart flows take over.
        sql`not exists (
          select 1 from cart_line cl
          join variant v on v.id = cl.variant_id
          join cart c on c.id = cl.cart_id
          where v.product_id = ${productView.productId}
            and (c.customer_id = ${productView.customerId}
              or (${customer.email} is not null and lower(c.email) = ${customer.email}))
            and c.updated_at > ${from.toISOString()}::timestamptz)`,
        // Bought since the view.
        sql`not exists (
          select 1 from order_line ol
          join variant v on v.id = ol.variant_id
          join "order" o on o.id = ol.order_id
          where v.product_id = ${productView.productId}
            and o.customer_id = ${productView.customerId}
            and o.status not in ('draft', 'cancelled')
            and o.placed_at >= ${productView.viewedAt})`,
        sql`not ${opts.ran(prefix, browseRepeatSince(opts.now))}`,
      ),
    )
    .orderBy(productView.viewedAt)
    .limit(SWEEP_LIMIT)
  return rows.map((r) => ({
    ...r,
    email: r.email?.trim().toLowerCase() || null,
    phone: decryptCustomerPhone(r.phone, opts.secret),
  }))
}

/**
 * The viewed product as the "Still thinking about it?" email shows it: `{product_title}`,
 * `{product_url}` (its page on the storefront) and `{product_price}` (the lowest variant price).
 * Empty when the product is gone.
 */
export async function browseProductFacts(
  tx: StoreTx,
  productId: string,
  storefrontUrl: string,
): Promise<MergeValues> {
  const [p] = await tx
    .select({
      title: product.title,
      handle: product.handle,
      pricePaise: sql<
        number | null
      >`(select min(${variant.pricePaise}) from ${variant} where ${variant.productId} = ${product.id})`,
    })
    .from(product)
    .where(eq(product.id, productId))
  if (!p) return {}
  return {
    product_title: p.title,
    product_url: `${storefrontUrl.replace(/\/$/, '')}/products/${encodeURIComponent(p.handle)}`,
    product_price: p.pricePaise == null ? '' : formatMoney(Number(p.pricePaise)),
  }
}
