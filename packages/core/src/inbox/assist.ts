/** SOURCE OF TRUTH: inboxAssistContext — WHAT: everything the staff AI help (suggested replies, chat summary) reads about one conversation: the thread with team notes, products the question names and the one the shopper is on, policies, shipping rates, the store notes, the live cart and, for a signed-in shopper and a member who may read orders, their orders with shipments / WHY: one read in one transaction before the model runs, so no transaction stays open during the call, and the same permission rule as the customer panel (an unverified email never reaches the prompt). */
import type { InboxAssistInput, InboxAssistOrder } from '@commerce/ai'
import { inboxConversation, inboxMessage, order, shipment } from '@commerce/db'
import { and, desc, eq, inArray, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { listShippingZones } from '../shipping/rates-service'
import { inboxAiPolicies, inboxAiProducts } from './ai-agent'
import { assistThread, awaitsReply, latestQuestion, pageOf, shippingRateLines } from './insights'
import { InboxError } from './messages'
import { conversationCart, viewedProduct } from './panel'
import { inboxState } from './state'

/** Messages of the conversation the AI help reads, newest last. */
const ASSIST_TURNS = 30
/** The signed-in shopper's own orders the suggestions may quote. */
const ASSIST_ORDERS = 5

export type InboxAssistContext = {
  installed: boolean
  storeName: string
  /** The newest message the shopper can see is theirs: suggestions apply. */
  awaitsReply: boolean
  /** Messages anyone wrote (shopper, team, AI), for the "long thread" rule. */
  messageCount: number
  input: InboxAssistInput
}

async function assistOrders(ctx: StoreContext, customerId: string): Promise<InboxAssistOrder[]> {
  const rows = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      placedAt: order.placedAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      totalPaise: order.totalPaise,
    })
    .from(order)
    .where(and(eq(order.customerId, customerId), ne(order.status, 'draft')))
    .orderBy(desc(order.placedAt))
    .limit(ASSIST_ORDERS)
  if (rows.length === 0) return []
  const parcels = await ctx.tx
    .select({
      orderId: shipment.orderId,
      provider: shipment.provider,
      waybill: shipment.waybill,
      status: shipment.status,
    })
    .from(shipment)
    .where(
      inArray(
        shipment.orderId,
        rows.map((r) => r.id),
      ),
    )
  return rows.map((o) => ({
    name: `#${o.number}`,
    placedAt: o.placedAt.toISOString().slice(0, 10),
    status: o.status,
    payment: o.paymentStatus,
    fulfillment: o.fulfillmentStatus,
    totalPaise: o.totalPaise,
    shipments: parcels
      .filter((s) => s.orderId === o.id && s.status !== 'cancelled')
      .map((s) => ({ courier: s.provider, waybill: s.waybill, status: s.status })),
  }))
}

/**
 * What the staff AI help reads for one conversation. Orders only for the thread's verified
 * customer and only when the member may read orders (`ordersAllowed`), as in the customer panel.
 */
export async function inboxAssistContext(
  ctx: StoreContext,
  conversationId: string,
  opts: { ordersAllowed: boolean },
): Promise<InboxAssistContext> {
  const state = await inboxState(ctx.tx, ctx.storeId)
  const [c] = await ctx.tx
    .select()
    .from(inboxConversation)
    .where(eq(inboxConversation.id, conversationId))
  if (!c) throw new InboxError('INBOX_NOT_FOUND', 'Conversation not found', ctx.storeId)
  const recent = (
    await ctx.tx
      .select({
        sender: inboxMessage.sender,
        kind: inboxMessage.kind,
        body: inboxMessage.body,
        payload: inboxMessage.payload,
      })
      .from(inboxMessage)
      .where(eq(inboxMessage.conversationId, c.id))
      .orderBy(desc(inboxMessage.id))
      .limit(ASSIST_TURNS)
  ).reverse()
  const question = latestQuestion(recent)
  const pages = recent.filter((m) => m.sender === 'shopper').map((m) => pageOf(m.payload))
  const lastPage = pages.filter((p) => p !== null).at(-1) ?? c.startedUrl
  const viewing = await viewedProduct(ctx.tx, lastPage)
  const zones = await listShippingZones(ctx.tx)
  const cart = await conversationCart(ctx, c)
  const thread = assistThread(recent)
  return {
    installed: state.installed,
    storeName: state.storeName,
    awaitsReply: awaitsReply(recent),
    messageCount: thread.filter((m) => m.from !== 'note').length,
    input: {
      knowledge: state.settings.ai.knowledge,
      policies: await inboxAiPolicies(ctx.tx),
      shipping: shippingRateLines(zones),
      products: question ? await inboxAiProducts(ctx.tx, question) : [],
      viewing:
        viewing?.active && viewing.minPricePaise !== null
          ? {
              id: viewing.id,
              title: viewing.title,
              pricePaise: viewing.minPricePaise,
              inStock: viewing.available,
              url: `/products/${viewing.handle}`,
              summary: '',
            }
          : null,
      orders: c.customerId && opts.ordersAllowed ? await assistOrders(ctx, c.customerId) : null,
      cart: cart
        ? {
            lines: cart.lines.map((l) => ({
              title: l.productTitle,
              quantity: l.quantity,
              linePaise: l.linePaise,
            })),
          }
        : null,
      thread,
    },
  }
}
