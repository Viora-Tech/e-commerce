import { createHmac, timingSafeEqual } from 'node:crypto'
import { cart, cartLine } from '@commerce/db'
import { and, desc, eq, gte, isNotNull, isNull, lt, or, type SQL, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

/**
 * Abandoned checkouts: carts that captured a contact at checkout and then went
 * quiet. A cart is only "abandoned" after a grace period, because a shopper
 * still typing their address has not abandoned anything.
 */

/** How long a cart must sit untouched before it counts as abandoned. */
export const ABANDONED_AFTER_MS = 60 * 60_000
/** How long a recovery link stays valid. */
export const RECOVERY_TTL_MS = 7 * 24 * 60 * 60_000

export type AbandonedCart = {
  id: string
  email: string | null
  phone: string | null
  customerName: string | null
  /** Title of the first line's product, for the "Cart" column ("Void Black Mousepad"). */
  firstTitle: string | null
  itemCount: number
  subtotalPaise: number
  updatedAt: Date
  recoverySentAt: Date | null
  /** The cart converted after we asked; the whole point of the feature. */
  recovered: boolean
}

export type AbandonedStats = {
  carts: number
  valuePaise: number
  recovered: number
  /** Share of abandoned carts in the window that later converted, 0 to 1. */
  recoveryRate: number
  /** Carts in the window that are not recovered yet (reminded or not). */
  notRecovered: number
  /** Carts in the window that got a recovery message. */
  remindersSent: number
}

/** The abandoned list's tabs after "All" (`?status=`). */
export const ABANDONED_LIST_STATUSES = ['not_recovered', 'reminder_sent', 'recovered'] as const
export type AbandonedListStatus = (typeof ABANDONED_LIST_STATUSES)[number]

/*
 * Written literally rather than with `${cart.id}`: Drizzle renders an
 * interpolated column unqualified inside a projection subquery, which binds to
 * the wrong scope and silently returns zero.
 */
const lineCount = sql<number>`(select coalesce(sum(cl.quantity), 0)::int from cart_line cl where cl.cart_id = cart.id)`
const firstTitle = sql<
  string | null
>`(select p.title from cart_line cl join variant v on v.id = cl.variant_id join product p on p.id = v.product_id where cl.cart_id = cart.id order by cl.id limit 1)`
const subtotal = sql<number>`(select coalesce(sum(cl.quantity * cl.unit_price_paise), 0)::int from cart_line cl where cl.cart_id = cart.id)`

/** The abandoned list's Contact filter: the shopper left an email, a phone number, or both. */
export const ABANDONED_CONTACTS = ['email', 'phone', 'both'] as const
export type AbandonedContact = (typeof ABANDONED_CONTACTS)[number]

/** The abandoned list's tab, search and filter panel. */
export type AbandonedListFilters = {
  /** How far back the list looks when no `activeFrom` is given (default 30 days). */
  sinceDays?: number | undefined
  now?: Date | undefined
  status?: AbandonedListStatus | undefined
  search?: string | undefined
  /** Last active at or after this moment; replaces the `sinceDays` window. */
  activeFrom?: string | undefined
  activeTo?: string | undefined
  valueMinPaise?: number | undefined
  valueMaxPaise?: number | undefined
  contact?: AbandonedContact | undefined
}

/** Carts with a contact, at least one line and no activity for the grace period. */
function abandonedWhere(now: Date, since: Date) {
  return and(
    or(isNotNull(cart.email), isNotNull(cart.phone)),
    gte(cart.updatedAt, since),
    lt(cart.updatedAt, new Date(now.getTime() - ABANDONED_AFTER_MS)),
    sql`${lineCount} > 0`,
  )
}

/** The filter panel's conditions on top of the window. */
function abandonedFilterWhere(input: AbandonedListFilters): (SQL | undefined)[] {
  const { contact } = input
  return [
    input.activeTo ? lt(cart.updatedAt, new Date(input.activeTo)) : undefined,
    input.valueMinPaise !== undefined ? sql`${subtotal} >= ${input.valueMinPaise}` : undefined,
    input.valueMaxPaise !== undefined ? sql`${subtotal} <= ${input.valueMaxPaise}` : undefined,
    contact === 'email' || contact === 'both' ? isNotNull(cart.email) : undefined,
    contact === 'phone' || contact === 'both' ? isNotNull(cart.phone) : undefined,
  ]
}

export async function listAbandoned(
  ctx: StoreContext,
  input: AbandonedListFilters & { page: number; perPage: number },
): Promise<{ items: AbandonedCart[]; total: number }> {
  const now = input.now ?? new Date()
  const since = input.activeFrom
    ? new Date(input.activeFrom)
    : new Date(now.getTime() - (input.sinceDays ?? 30) * 86_400_000)
  const search = input.search?.trim()
  const where = and(
    abandonedWhere(now, since),
    ...abandonedFilterWhere(input),
    input.status === 'recovered' ? eq(cart.status, 'converted') : undefined,
    input.status === 'not_recovered' ? sql`${cart.status} <> 'converted'` : undefined,
    input.status === 'reminder_sent'
      ? and(sql`${cart.status} <> 'converted'`, isNotNull(cart.recoverySentAt))
      : undefined,
    search
      ? sql`(${cart.email} ilike ${`%${search}%`} or ${cart.phone} ilike ${`%${search}%`} or ${cart.customerName} ilike ${`%${search}%`})`
      : undefined,
  )
  const [countRow] = await ctx.tx
    .select({ total: sql<number>`count(*)::int` })
    .from(cart)
    .where(where)
  const rows = await ctx.tx
    .select({
      id: cart.id,
      email: cart.email,
      phone: cart.phone,
      customerName: cart.customerName,
      status: cart.status,
      updatedAt: cart.updatedAt,
      recoverySentAt: cart.recoverySentAt,
      firstTitle,
      itemCount: lineCount,
      subtotalPaise: subtotal,
    })
    .from(cart)
    .where(where)
    .orderBy(desc(cart.updatedAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  return {
    items: rows.map(({ status, ...r }) => ({ ...r, recovered: status === 'converted' })),
    total: countRow?.total ?? 0,
  }
}

export async function abandonedStats(
  ctx: StoreContext,
  opts: { days?: number | undefined; now?: Date | undefined } = {},
): Promise<AbandonedStats> {
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - (opts.days ?? 7) * 86_400_000)
  const rows = await ctx.tx
    .select({ status: cart.status, subtotalPaise: subtotal, sentAt: cart.recoverySentAt })
    .from(cart)
    .where(abandonedWhere(now, since))
  const recovered = rows.filter((r) => r.status === 'converted').length
  return {
    carts: rows.length,
    valuePaise: rows
      .filter((r) => r.status !== 'converted')
      .reduce((sum, r) => sum + r.subtotalPaise, 0),
    recovered,
    recoveryRate: rows.length === 0 ? 0 : recovered / rows.length,
    notRecovered: rows.length - recovered,
    remindersSent: rows.filter((r) => r.sentAt !== null).length,
  }
}

export async function getAbandonedCart(ctx: StoreContext, cartId: string) {
  const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, cartId))
  if (!c) return null
  const lines = await ctx.tx
    .select({
      id: cartLine.id,
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
      variantId: cartLine.variantId,
    })
    .from(cartLine)
    .where(eq(cartLine.cartId, cartId))
  return { ...c, lines }
}

/**
 * Signed recovery link. The cart id alone would let anyone walk ids and read
 * a stranger's basket, so the link carries an HMAC over the id and an expiry.
 */
export function recoveryToken(cartId: string, secret: string, now = new Date()): string {
  const expires = now.getTime() + RECOVERY_TTL_MS
  const body = `${cartId}.${expires}`
  return `${body}.${sign(body, secret)}`
}

export function verifyRecoveryToken(
  token: string,
  secret: string,
  now = new Date(),
): { ok: true; cartId: string } | { ok: false; reason: 'malformed' | 'expired' | 'signature' } {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [cartId, expires, mac] = parts as [string, string, string]
  const expiresAt = Number(expires)
  if (!cartId || !Number.isFinite(expiresAt)) return { ok: false, reason: 'malformed' }
  const expected = sign(`${cartId}.${expires}`, secret)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: 'signature' }
  if (expiresAt < now.getTime()) return { ok: false, reason: 'expired' }
  return { ok: true, cartId }
}

function sign(body: string, secret: string): string {
  // Purpose-prefixed like preorder/balance-link.ts, so a recovery token can
  // never be confused with another `<id>.<expiry>` token signed with the same
  // secret. Changing the prefix invalidates in-flight recovery links (7-day TTL).
  return createHmac('sha256', secret).update(`recovery:${body}`).digest('base64url')
}

export const recoveryPath = (token: string) => `/checkout/recover/${token}`

export function recoveryUrl(cartId: string, secret: string, storefrontUrl: string): string {
  return `${storefrontUrl.replace(/\/$/, '')}${recoveryPath(recoveryToken(cartId, secret))}`
}

/** Contact typed into the checkout form; what turns a cart into a recoverable one. */
export async function captureCartContact(
  ctx: StoreContext,
  cartId: string,
  contact: { email?: string | undefined; phone?: string | undefined; name?: string | undefined },
) {
  const email = contact.email?.trim().toLowerCase()
  const [row] = await ctx.tx
    .update(cart)
    .set({
      email: email || null,
      phone: contact.phone?.trim() || null,
      customerName: contact.name?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(cart.id, cartId), eq(cart.status, 'open')))
    .returning({ id: cart.id })
  return row ?? null
}

export async function markRecoverySent(ctx: StoreContext, cartId: string, at = new Date()) {
  await ctx.tx.update(cart).set({ recoverySentAt: at }).where(eq(cart.id, cartId))
}

/** Carts that deserve an automatic nudge: quiet long enough, never nudged before. */
export async function cartsAwaitingRecovery(
  ctx: StoreContext,
  opts: { afterMs: number; limit?: number | undefined; now?: Date | undefined },
) {
  const now = opts.now ?? new Date()
  const cutoff = new Date(now.getTime() - opts.afterMs)
  return ctx.tx
    .select({ id: cart.id, email: cart.email })
    .from(cart)
    .where(
      and(
        eq(cart.status, 'open'),
        isNotNull(cart.email),
        isNull(cart.recoverySentAt),
        lt(cart.updatedAt, cutoff),
        sql`${lineCount} > 0`,
      ),
    )
    .limit(opts.limit ?? 50)
}
