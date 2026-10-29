/** SOURCE OF TRUTH: "Click to chat" on WhatsApp — WHAT: the phone, names and signed links a staff member's own wa.me chat is typed from, and the timeline line once they open it / WHY: works with no WhatsApp channel connected, so it must never depend on one */
import {
  address,
  cart,
  cartLine,
  customer,
  customerNote,
  order,
  orderNote,
  shipment,
  store,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { and, desc, eq, ne } from 'drizzle-orm'
import { recoveryUrl } from '../cart/abandoned'
import type { StoreContext } from '../context'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { storefrontOriginFor } from '../domains/origin'
import { balanceOwed } from '../preorder/balance'
import { balanceUrl, invoiceUrl, thankYouUrl } from '../preorder/balance-link'

/** The messages a staff member can start a chat from; `blank` is an empty chat. */
export const WHATSAPP_CHAT_TEMPLATES = [
  'payment',
  'order_confirmation',
  'shipping_update',
  'cart_recovery',
  'blank',
] as const
export type WhatsappChatTemplate = (typeof WHATSAPP_CHAT_TEMPLATES)[number]

/** What the chat is about: an order (drafts included), a customer or an abandoned checkout. */
export type WhatsappChatTarget = { kind: 'order' | 'customer' | 'checkout'; id: string }

/** Everything the admin fills a chat template with. Links are absent when they do not apply. */
export type WhatsappChatContext = {
  phone: string | null
  storeName: string
  customerName: string | null
  orderNumber: number | null
  totalLabel: string | null
  waybill: string | null
  links: {
    /** Draft invoice, preorder balance or an unpaid order's own page (it shows how to pay). */
    payment?: string
    /** The signed order page (thank-you / status). */
    order?: string
    tracking?: string
    /** The abandoned checkout's signed recovery link; absent once it became an order. */
    recovery?: string
  }
}

type LinkOpts = { storefrontUrl: string; settingsSecret: string }

/** Methods paid on delivery or already settled: there is nothing to send a payment link for. */
const NO_PAY_LINK = new Set(['cod', 'gift_card'])

/** The labels the timeline line names the message by. */
const WHATSAPP_CHAT_LABEL: Record<WhatsappChatTemplate, string> = {
  payment: 'payment link',
  order_confirmation: 'order confirmation',
  shipping_update: 'shipping update',
  cart_recovery: 'cart recovery',
  blank: 'blank message',
}

/** The timeline line once a staff member opened the chat. */
const WHATSAPP_CHAT_NOTE = (template: WhatsappChatTemplate) =>
  `Opened WhatsApp chat (${WHATSAPP_CHAT_LABEL[template]}).`

async function storeName(ctx: StoreContext): Promise<string> {
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  return s?.name ?? ''
}

/** One order's chat details (phone, name, links); null when it is gone. */
async function orderChat(
  ctx: StoreContext,
  orderId: string,
  origin: string,
  secret: string,
): Promise<Omit<WhatsappChatContext, 'storeName'> | null> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) return null
  const [ship] = o.shippingAddressId
    ? await ctx.tx
        .select({ name: address.name, phone: address.phone })
        .from(address)
        .where(eq(address.id, o.shippingAddressId))
    : []
  const [cu] = o.customerId
    ? await ctx.tx
        .select({ name: customer.name })
        .from(customer)
        .where(eq(customer.id, o.customerId))
    : []
  const [parcel] = await ctx.tx
    .select({ waybill: shipment.waybill, trackingUrl: shipment.trackingUrl })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
  const links: WhatsappChatContext['links'] = {}
  if (o.status === 'draft') {
    links.payment = invoiceUrl(o.id, secret, origin)
  } else {
    links.order = thankYouUrl(o.id, o.number, secret, origin)
    if (balanceOwed(o) > 0) links.payment = balanceUrl(o.id, secret, origin)
    else if (
      o.status === 'open' &&
      o.paymentStatus === 'unpaid' &&
      !NO_PAY_LINK.has(o.paymentMethod ?? '')
    ) {
      links.payment = links.order
    }
    if (parcel?.trackingUrl) links.tracking = parcel.trackingUrl
  }
  return {
    phone: o.phone || ship?.phone || null,
    customerName: cu?.name || ship?.name || null,
    orderNumber: o.status === 'draft' ? null : o.number,
    totalLabel: formatMoney(o.totalPaise),
    waybill: parcel?.waybill ?? null,
    links,
  }
}

/**
 * What a staff member's WhatsApp chat is typed from. A customer's chat carries their latest
 * order's links (and that order's phone when the customer has none). Null when it is gone.
 */
export async function whatsappChatContext(
  ctx: StoreContext,
  target: WhatsappChatTarget,
  opts: LinkOpts,
): Promise<WhatsappChatContext | null> {
  const origin = await storefrontOriginFor(ctx.tx, ctx.storeId, opts.storefrontUrl)
  const name = await storeName(ctx)
  if (target.kind === 'order') {
    const chat = await orderChat(ctx, target.id, origin, opts.settingsSecret)
    return chat ? { ...chat, storeName: name } : null
  }
  if (target.kind === 'checkout') {
    const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, target.id))
    if (!c) return null
    const lines = await ctx.tx
      .select({ quantity: cartLine.quantity, unitPricePaise: cartLine.unitPricePaise })
      .from(cartLine)
      .where(eq(cartLine.cartId, c.id))
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)
    return {
      phone: c.phone ?? null,
      storeName: name,
      customerName: c.customerName || null,
      orderNumber: null,
      totalLabel: lines.length ? formatMoney(subtotal) : null,
      waybill: null,
      links:
        c.status === 'converted'
          ? {}
          : { recovery: recoveryUrl(c.id, opts.settingsSecret, origin) },
    }
  }
  const [cu] = await ctx.tx.select().from(customer).where(eq(customer.id, target.id))
  if (!cu) return null
  const [latest] = await ctx.tx
    .select({ id: order.id })
    .from(order)
    .where(and(eq(order.customerId, cu.id), ne(order.status, 'draft')))
    .orderBy(desc(order.placedAt))
    .limit(1)
  const chat = latest ? await orderChat(ctx, latest.id, origin, opts.settingsSecret) : null
  return {
    phone: decryptCustomerPhone(cu.phone, opts.settingsSecret) || chat?.phone || null,
    storeName: name,
    customerName: cu.name || chat?.customerName || null,
    orderNumber: chat?.orderNumber ?? null,
    totalLabel: chat?.totalLabel ?? null,
    waybill: chat?.waybill ?? null,
    links: chat?.links ?? {},
  }
}

/**
 * A staff member opened a WhatsApp chat in their own app: the line goes on the order's timeline,
 * or the customer's (a checkout's signed-in customer, when it has one). Nothing is sent from
 * here. False when there is nowhere to record it.
 */
export async function noteWhatsappChat(
  ctx: StoreContext,
  target: WhatsappChatTarget,
  opts: { template: WhatsappChatTemplate; author?: string | undefined },
): Promise<boolean> {
  const body = WHATSAPP_CHAT_NOTE(opts.template)
  const author = opts.author ?? 'system'
  if (target.kind === 'order') {
    const [o] = await ctx.tx.select({ id: order.id }).from(order).where(eq(order.id, target.id))
    if (!o) return false
    await ctx.tx.insert(orderNote).values({ storeId: ctx.storeId, orderId: o.id, body, author })
    return true
  }
  let customerId: string | null = null
  if (target.kind === 'checkout') {
    const [c] = await ctx.tx
      .select({ customerId: cart.customerId })
      .from(cart)
      .where(eq(cart.id, target.id))
    customerId = c?.customerId ?? null
  } else {
    const [cu] = await ctx.tx
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.id, target.id))
    customerId = cu?.id ?? null
  }
  if (!customerId) return false
  await ctx.tx.insert(customerNote).values({ storeId: ctx.storeId, customerId, body, author })
  return true
}
