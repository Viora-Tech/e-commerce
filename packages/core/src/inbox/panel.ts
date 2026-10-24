/** SOURCE OF TRUTH: messageCards, customerPanel, inboxAssignees, inboxMetrics — WHAT: what the admin inbox draws beside the messages: the products and codes a thread's cards point at, the customer panel (new or returning, verified or a possible match, the live cart, recent orders, notes), the team members a conversation can be assigned to, and the Inbox home's 30-day numbers / WHY: one read per pane instead of N lookups in the browser; an unverified email never shows orders (design §2 anti-goals, §6). */
import {
  authSchema,
  cart,
  customer,
  discount,
  inboxConversation,
  inboxMessage,
  media,
  order,
  product,
  productMedia,
  role,
  rolePermission,
  type StoreTx,
  storeMember,
  variant,
} from '@commerce/db'
import { and, asc, desc, eq, gte, inArray, isNull, min, or, sql } from 'drizzle-orm'
import { getCart } from '../cart/cart'
import type { StoreContext } from '../context'
import { isShareableDiscount } from './conversations'
import { InboxError } from './messages'

export type CardProduct = {
  id: string
  title: string
  handle: string
  imageUrl: string | null
  minPricePaise: number | null
  active: boolean
}
export type CardDiscount = { id: string; code: string | null; title: string; active: boolean }
export type MessageCards = {
  products: Record<string, CardProduct>
  discounts: Record<string, CardDiscount>
}

const idsOf = (payload: unknown, key: string): string[] => {
  const v =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>)[key] : null
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return typeof v === 'string' ? [v] : []
}

/** The products and discount codes the cards in `messages` point at, as they are now. */
export async function messageCards(
  tx: StoreTx,
  messages: { kind: string; payload: unknown }[],
): Promise<MessageCards> {
  const productIds = [
    ...new Set(
      messages.filter((m) => m.kind === 'product').flatMap((m) => idsOf(m.payload, 'productIds')),
    ),
  ]
  const discountIds = [
    ...new Set(
      messages.filter((m) => m.kind === 'discount').flatMap((m) => idsOf(m.payload, 'discountId')),
    ),
  ]
  const out: MessageCards = { products: {}, discounts: {} }
  if (productIds.length > 0) {
    const rows = await tx
      .select({
        id: product.id,
        title: product.title,
        handle: product.handle,
        status: product.status,
        minPricePaise: min(variant.pricePaise),
      })
      .from(product)
      .leftJoin(variant, eq(variant.productId, product.id))
      .where(inArray(product.id, productIds))
      .groupBy(product.id)
    const images = await tx
      .select({ productId: productMedia.productId, url: media.url })
      .from(productMedia)
      .innerJoin(media, eq(media.id, productMedia.mediaId))
      .where(inArray(productMedia.productId, productIds))
      .orderBy(asc(productMedia.position))
    for (const r of rows) {
      out.products[r.id] = {
        id: r.id,
        title: r.title,
        handle: r.handle,
        imageUrl: images.find((i) => i.productId === r.id)?.url ?? null,
        minPricePaise: r.minPricePaise ?? null,
        active: r.status === 'active',
      }
    }
  }
  if (discountIds.length > 0) {
    const rows = await tx.select().from(discount).where(inArray(discount.id, discountIds))
    for (const d of rows) {
      out.discounts[d.id] = {
        id: d.id,
        code: d.code,
        title: d.title,
        active: isShareableDiscount(d),
      }
    }
  }
  return out
}

/** The latest cart id a cart line in this thread carried (guests have no customer to look up). */
async function threadCartId(tx: StoreTx, conversationId: string): Promise<string | null> {
  const [row] = await tx
    .select({ cartId: sql<string | null>`${inboxMessage.payload} ->> 'cartId'` })
    .from(inboxMessage)
    .where(
      and(
        eq(inboxMessage.conversationId, conversationId),
        eq(inboxMessage.kind, 'cart_event'),
        sql`${inboxMessage.payload} ? 'cartId'`,
      ),
    )
    .orderBy(desc(inboxMessage.id))
    .limit(1)
  return row?.cartId ?? null
}

export type CustomerPanel = {
  /** The signed-in customer the thread belongs to (verified). */
  customer: {
    id: string
    name: string | null
    email: string | null
    note: string | null
    tags: string[]
    orderCount: number
    totalSpentPaise: number
    createdAt: Date
  } | null
  /** A guest typed an email that matches a customer: shown with an Unverified chip, no orders. */
  possibleMatch: { id: string; name: string | null; email: string | null } | null
  returning: boolean
  /** Only for a verified customer, and only when the member may read orders. */
  orders: { id: string; number: number; totalPaise: number; placedAt: Date; status: string }[]
  cart: Awaited<ReturnType<typeof getCart>>
}

/**
 * The customer panel. Orders appear only for the verified customer of the thread and only
 * when the member may read orders; a typed email is a "possible match", never a login.
 */
export async function customerPanel(
  ctx: StoreContext,
  conversationId: string,
  opts: { ordersAllowed: boolean },
): Promise<CustomerPanel> {
  const [c] = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(eq(inboxConversation.id, conversationId))
  if (!c) throw new InboxError('INBOX_NOT_FOUND', 'Conversation not found', ctx.storeId)

  let panelCustomer: CustomerPanel['customer'] = null
  let possibleMatch: CustomerPanel['possibleMatch'] = null
  let orders: CustomerPanel['orders'] = []
  if (c.customerId) {
    const [row] = await ctx.tx
      .select({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        note: customer.note,
        tags: customer.tags,
        createdAt: customer.createdAt,
        orderCount: sql<number>`(select count(*)::int from ${order} where ${order.customerId} = ${c.customerId} and ${order.status} <> 'draft')`,
        totalSpentPaise: sql<number>`(select coalesce(sum(${order.totalPaise}), 0)::int from ${order} where ${order.customerId} = ${c.customerId} and ${order.status} not in ('draft', 'cancelled'))`,
      })
      .from(customer)
      .where(eq(customer.id, c.customerId))
    panelCustomer = row ?? null
    if (row && opts.ordersAllowed) {
      orders = await ctx.tx
        .select({
          id: order.id,
          number: order.number,
          totalPaise: order.totalPaise,
          placedAt: order.placedAt,
          status: order.status,
        })
        .from(order)
        .where(and(eq(order.customerId, row.id), sql`${order.status} <> 'draft'`))
        .orderBy(desc(order.placedAt))
        .limit(5)
    }
  } else if (c.contactEmail) {
    const [row] = await ctx.tx
      .select({ id: customer.id, name: customer.name, email: customer.email })
      .from(customer)
      .where(and(eq(customer.email, c.contactEmail), isNull(customer.anonymisedAt)))
    possibleMatch = row ?? null
  }

  const [openCart] = c.customerId
    ? await ctx.tx
        .select({ id: cart.id })
        .from(cart)
        .where(and(eq(cart.customerId, c.customerId), eq(cart.status, 'open')))
        .orderBy(desc(cart.updatedAt))
        .limit(1)
    : []
  const cartId = openCart?.id ?? (await threadCartId(ctx.tx, conversationId))
  const liveCart = cartId ? await getCart(ctx, cartId) : null
  const [earlier] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(inboxConversation)
    .where(
      and(
        c.customerId
          ? eq(inboxConversation.customerId, c.customerId)
          : eq(inboxConversation.visitorKeyHash, c.visitorKeyHash ?? ''),
        sql`${inboxConversation.id} <> ${c.id}`,
      ),
    )
  return {
    customer: panelCustomer,
    possibleMatch,
    returning: (panelCustomer?.orderCount ?? 0) > 0 || (earlier?.n ?? 0) > 0,
    orders,
    cart: liveCart && liveCart.status === 'open' ? liveCart : null,
  }
}

/** Team members who can reply (owners, and roles with `inbox.reply`), for Assign. */
export async function inboxAssignees(tx: StoreTx) {
  return tx
    .selectDistinct({
      userId: storeMember.userId,
      name: authSchema.user.name,
      email: authSchema.user.email,
    })
    .from(storeMember)
    .innerJoin(authSchema.user, eq(authSchema.user.id, storeMember.userId))
    .innerJoin(role, eq(role.id, storeMember.roleId))
    .leftJoin(
      rolePermission,
      and(eq(rolePermission.roleId, role.id), eq(rolePermission.permission, 'inbox.reply')),
    )
    .where(
      and(
        eq(storeMember.status, 'active'),
        or(eq(role.slug, 'owner'), sql`${rolePermission.id} is not null`),
      ),
    )
    .orderBy(asc(authSchema.user.name))
}

export type InboxMetrics = {
  conversations: number
  messages: number
  /** Median minutes from a conversation's start to the first staff reply; null with none. */
  medianFirstResponseMinutes: number | null
  /** Started in the window and answered by staff. */
  answered: number
}

/** The Inbox home's numbers for the last `days` days. */
export async function inboxMetrics(
  ctx: StoreContext,
  now: Date = new Date(),
  days = 30,
): Promise<InboxMetrics> {
  const since = new Date(now.getTime() - days * 86_400_000)
  const [conv] = await ctx.tx
    .select({
      conversations: sql<number>`count(*)::int`,
      answered: sql<number>`count(${inboxConversation.firstResponseAt})::int`,
      median: sql<
        number | null
      >`percentile_cont(0.5) within group (order by extract(epoch from (${inboxConversation.firstResponseAt} - ${inboxConversation.createdAt})) / 60)`,
    })
    .from(inboxConversation)
    .where(gte(inboxConversation.createdAt, since))
  const [msgs] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(inboxMessage)
    .where(
      and(
        gte(inboxMessage.createdAt, since),
        inArray(inboxMessage.sender, ['shopper', 'staff', 'ai']),
      ),
    )
  return {
    conversations: conv?.conversations ?? 0,
    messages: msgs?.n ?? 0,
    medianFirstResponseMinutes:
      conv?.median === null || conv?.median === undefined ? null : Math.round(Number(conv.median)),
    answered: conv?.answered ?? 0,
  }
}

/** Codes staff may share (on, a code, inside their dates), newest first, for the Discount picker. */
export async function shareableDiscounts(
  tx: StoreTx,
  now: Date = new Date(),
): Promise<CardDiscount[]> {
  const rows = await tx
    .select()
    .from(discount)
    .where(and(eq(discount.kind, 'code'), eq(discount.status, 'active')))
    .orderBy(desc(discount.createdAt))
    .limit(200)
  return rows
    .filter((d) => isShareableDiscount(d, now))
    .map((d) => ({ id: d.id, code: d.code, title: d.title, active: true }))
}
