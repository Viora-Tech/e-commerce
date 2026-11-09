/** SOURCE OF TRUTH: duplicate and repeated checkouts — WHAT: `findRecentDuplicateCheckout` (the shopper's recent order with the same items, unpaid or placed), `recentUnpaidCheckouts` (their unpaid checkouts in the last hour) and the errors `placeOrder` throws for them / WHY: failed card retries and never-paid transfers each became a new order; the later "unpaid checkouts as drafts" design (docs/design/unpaid-checkouts-as-drafts.md) points this one helper at drafts instead */
import { order, orderLine, store } from '@commerce/db'
import { and, desc, eq, inArray, isNull, ne, or, type SQL, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import {
  type CheckoutContactKeys,
  orderContactMatch,
  sameEmailAndPhone,
} from '../payments/manual-unpaid'
import { parsePaymentSettings } from '../payments/settings'

const HOUR_MS = 3_600_000
/** How many of the shopper's recent orders are compared line by line. */
const CANDIDATES = 20

/** A recent order of this shopper's, as the storefront needs it to link and word the refusal. */
export type RecentCheckout = {
  id: string
  number: number
  /** Set while it is a checkout draft: the shopper sees and pays #D57, not an order number. */
  draftNumber: number | null
  customerId: string | null
  email: string | null
  phone: string | null
  paymentMethod: string | null
  placedAt: Date
}

export type DuplicateKind =
  /** Still waiting for its money (a transfer, a gateway payment pending or failed): resume it. */
  | 'unpaid'
  /** Paid, authorised or cash on delivery: the shopper may mean to order again. */
  | 'placed'

/**
 * The cart holds exactly the items of an order this shopper placed in the store's window.
 * `unpaid` refuses the checkout ("Complete payment"); `placed` asks first ("Order again?") and
 * is passed by `orderAgain`. `sameContact` is true when both the email and the phone match,
 * which lets the storefront link a guest to the order.
 */
export class DuplicateCheckout extends CommerceError {
  readonly kind: DuplicateKind
  readonly order: RecentCheckout
  readonly sameContact: boolean
  readonly minutesAgo: number

  constructor(
    kind: DuplicateKind,
    o: RecentCheckout,
    opts: { sameContact: boolean; now: Date; storeId?: string | undefined },
  ) {
    const ref = o.draftNumber ? `D${o.draftNumber}` : String(o.number)
    super('DUPLICATE_CHECKOUT', `These items were ordered as #${ref} (${kind})`, {
      storeId: opts.storeId,
    })
    this.kind = kind
    this.order = o
    this.sameContact = opts.sameContact
    this.minutesAgo = Math.max(1, Math.round((opts.now.getTime() - o.placedAt.getTime()) / 60_000))
  }
}

/** The shopper hit the store's cap of unpaid checkouts in an hour. `latest` is the newest one. */
export class TooManyUnpaidCheckouts extends CommerceError {
  readonly latest: RecentCheckout | null

  constructor(latest: RecentCheckout | null, storeId?: string | undefined) {
    super('TOO_MANY_UNPAID_CHECKOUTS', 'Too many unpaid checkouts in the last hour', { storeId })
    this.latest = latest
  }
}

const recentColumns = {
  id: order.id,
  number: order.number,
  draftNumber: sql<
    number | null
  >`case when ${order.status} = 'draft' then ${order.draftNumber} end`,
  customerId: order.customerId,
  email: order.email,
  phone: order.phone,
  paymentMethod: order.paymentMethod,
  // A checkout draft counts from its last activity (the shopper came back), an order from its placing.
  placedAt: sql<Date>`coalesce(${order.lastActivityAt}, ${order.placedAt})`.mapWith(order.placedAt),
  status: order.status,
  checkoutPaidAt: order.checkoutPaidAt,
  paymentStatus: order.paymentStatus,
}

/**
 * Orders and the open checkout drafts (an unpaid checkout kept as a draft until paid, 0233):
 * staff drafts and expired checkout drafts are not the shopper's checkouts to resume.
 */
const ordersAndOpenCheckoutDrafts = (): SQL | undefined =>
  or(
    ne(order.status, 'draft'),
    and(eq(order.draftSource, 'checkout'), isNull(order.draftExpiredAt)),
  )

/** Ordered or open checkout drafts, last active since `since`. */
const activeSince = (since: Date): SQL =>
  sql`coalesce(${order.lastActivityAt}, ${order.placedAt}) >= ${since.toISOString()}::timestamptz`

/**
 * Waiting for its money: an open checkout draft, or an open order with nothing captured at
 * checkout, not cash on delivery or authorised.
 */
const isUnpaid = (o: {
  status: string
  checkoutPaidAt: Date | null
  paymentMethod: string | null
  paymentStatus: string
}) =>
  o.status === 'draft' ||
  (o.status === 'open' &&
    o.checkoutPaidAt === null &&
    o.paymentMethod !== 'cod' &&
    o.paymentStatus !== 'authorized')

/** `variantId:quantity` pairs, quantities summed per variant, sorted: line order does not count. */
export function itemsKey(lines: readonly { variantId: string | null; quantity: number }[]): string {
  const per = new Map<string, number>()
  for (const l of lines) {
    const id = l.variantId ?? 'custom'
    per.set(id, (per.get(id) ?? 0) + l.quantity)
  }
  return [...per.entries()]
    .map(([id, q]) => `${id}:${q}`)
    .sort()
    .join(',')
}

const pick = ({
  status: _s,
  checkoutPaidAt: _c,
  paymentStatus: _p,
  ...o
}: RecentRow): RecentCheckout => o

type RecentRow = RecentCheckout & {
  status: string
  checkoutPaidAt: Date | null
  paymentStatus: string
}

/**
 * The shopper's order from the last `windowHours` with exactly these items (variant ids and
 * quantities, any order), not cancelled: `unpaid` when it still waits for its money, else
 * `placed`. An unpaid match wins over a placed one. Null when there is none, the window is 0,
 * or there is no email or phone to match by.
 */
export async function findRecentDuplicateCheckout(
  ctx: StoreContext,
  input: {
    contact: CheckoutContactKeys
    lines: readonly { variantId: string; quantity: number }[]
    windowHours: number
    now?: Date | undefined
  },
): Promise<{ kind: DuplicateKind; order: RecentCheckout } | null> {
  const match = orderContactMatch(input.contact)
  if (!match || input.windowHours <= 0 || input.lines.length === 0) return null
  const now = input.now ?? new Date()
  const since = new Date(now.getTime() - input.windowHours * HOUR_MS)
  const rows: RecentRow[] = await ctx.tx
    .select(recentColumns)
    .from(order)
    .where(
      and(
        ne(order.status, 'cancelled'),
        ordersAndOpenCheckoutDrafts(),
        isNull(order.importedFrom),
        activeSince(since),
        match,
      ),
    )
    .orderBy(desc(sql`coalesce(${order.lastActivityAt}, ${order.placedAt})`))
    .limit(CANDIDATES)
  if (rows.length === 0) return null
  const lines = await ctx.tx
    .select({
      orderId: orderLine.orderId,
      variantId: orderLine.variantId,
      quantity: orderLine.quantity,
    })
    .from(orderLine)
    .where(
      inArray(
        orderLine.orderId,
        rows.map((r) => r.id),
      ),
    )
  const want = itemsKey(input.lines)
  const same = rows.filter((r) => itemsKey(lines.filter((l) => l.orderId === r.id)) === want)
  const unpaid = same.find(isUnpaid)
  if (unpaid) return { kind: 'unpaid', order: pick(unpaid) }
  const placed = same[0]
  return placed ? { kind: 'placed', order: pick(placed) } : null
}

/**
 * The shopper's checkouts placed in the last hour that never got their money (cancelled ones
 * too: a failed card retry is cancelled after 30 minutes), cash on delivery left out. The
 * newest still-unpaid one comes back to link.
 */
export async function recentUnpaidCheckouts(
  ctx: StoreContext,
  input: { contact: CheckoutContactKeys; now?: Date | undefined },
): Promise<{ count: number; latest: RecentCheckout | null }> {
  const match = orderContactMatch(input.contact)
  if (!match) return { count: 0, latest: null }
  const since = new Date((input.now ?? new Date()).getTime() - HOUR_MS)
  // Checkout drafts count, expired ones too (a failed card retry used to be cancelled the same way).
  const where: SQL | undefined = and(
    or(ne(order.status, 'draft'), eq(order.draftSource, 'checkout')),
    isNull(order.checkoutPaidAt),
    ne(order.paymentMethod, 'cod'),
    ne(order.paymentStatus, 'authorized'),
    isNull(order.importedFrom),
    activeSince(since),
    match,
  )
  const rows: RecentRow[] = await ctx.tx
    .select(recentColumns)
    .from(order)
    .where(where)
    .orderBy(desc(sql`coalesce(${order.lastActivityAt}, ${order.placedAt})`))
  const latest = rows.find(isUnpaid)
  return { count: rows.length, latest: latest ? pick(latest) : null }
}

/** The store's cap of unpaid checkouts per hour (0: none), for the storefront's per-IP count. */
export async function unpaidCheckoutsPerHourOf(ctx: StoreContext): Promise<number> {
  const [s] = await ctx.tx
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parsePaymentSettings(s?.payments).unpaidCheckoutsPerHour
}

/**
 * The checks `placeOrder` runs for a storefront checkout, in order: the same items still
 * unpaid (refused), the same items placed (asks, unless `orderAgain`), then the hourly cap
 * of unpaid checkouts (not for cash on delivery). Throws; returns nothing when all pass.
 */
export async function enforceCheckoutRepeats(
  ctx: StoreContext,
  input: {
    contact: CheckoutContactKeys
    lines: readonly { variantId: string; quantity: number }[]
    paymentMethod: string
    windowHours: number
    unpaidPerHour: number
    orderAgain?: boolean | undefined
    now?: Date | undefined
  },
): Promise<void> {
  const now = input.now ?? new Date()
  const dup = await findRecentDuplicateCheckout(ctx, { ...input, now })
  if (dup && (dup.kind === 'unpaid' || !input.orderAgain)) {
    throw new DuplicateCheckout(dup.kind, dup.order, {
      sameContact: sameEmailAndPhone(dup.order, input.contact),
      now,
      storeId: ctx.storeId,
    })
  }
  if (input.paymentMethod === 'cod' || input.unpaidPerHour <= 0) return
  const recent = await recentUnpaidCheckouts(ctx, { contact: input.contact, now })
  if (recent.count >= input.unpaidPerHour) {
    throw new TooManyUnpaidCheckouts(recent.latest, ctx.storeId)
  }
}
