/** SOURCE OF TRUTH: sales channels — WHAT: load and save `store.preferences.salesChannels` (agent controls, each channel's connect request), score the catalog for AI agents, and count the orders each channel brought (from the order's marketing attribution) / WHY: Agentic sales and Social media read one result, inside RLS, and a save never overwrites other preferences */
import {
  collectionProduct,
  customer,
  type MarketingAttribution,
  order,
  product,
  store,
} from '@commerce/db'
import { and, eq, gte, isNotNull, ne, sql } from 'drizzle-orm'
import { notSystemTest } from '../catalog/system-test'
import type { StoreContext } from '../context'
import { listPolicies } from '../policies/service'
import { loadSeoProductItems } from '../seo/service'
import {
  type AgentControls,
  AgentControlsSchema,
  AI_AGENTS,
  type CatalogReadiness,
  type ChannelState,
  type ConnectRequest,
  ConnectRequestSchema,
  channelOfAttribution,
  channelState,
  NOT_CONNECTED,
  parseSalesChannels,
  type SalesChannelId,
  type SalesChannelsSettings,
  type SocialChannel,
} from './client'
import { catalogReadiness } from './readiness'

const DAY = 86_400_000
/** The window every channel number covers, against the one before it. */
const CHANNEL_PERIOD_DAYS = 30
/** More channel orders than this in two periods and the oldest are left out of the counts. */
const MAX_ORDERS = 20_000

async function loadSettings(ctx: StoreContext): Promise<SalesChannelsSettings> {
  const [s] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseSalesChannels(s?.preferences)
}

async function saveSettings(ctx: StoreContext, next: SalesChannelsSettings): Promise<void> {
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ salesChannels: next })}::jsonb`,
    })
    .where(eq(store.id, ctx.storeId))
}

/** The saved sales-channel settings, for the connect and sync code (`connect.ts`, `sync.ts`). */
export const loadSalesChannelSettings = loadSettings

/**
 * Replaces the state of the channels named in `patch`, leaving the rest and the agent controls
 * as they are. One read and one write inside the caller's transaction.
 */
export async function patchChannelStates(
  ctx: StoreContext,
  patch: Partial<Record<SalesChannelId, ChannelState>>,
): Promise<void> {
  const settings = await loadSettings(ctx)
  await saveSettings(ctx, { ...settings, channels: { ...settings.channels, ...patch } })
}

/** The readiness report over every live product and the published policies. */
export async function loadCatalogReadiness(ctx: StoreContext): Promise<CatalogReadiness> {
  const [items, policies] = await Promise.all([loadSeoProductItems(ctx.tx), listPolicies(ctx)])
  return catalogReadiness(
    items.map((i) => ({
      id: i.id,
      title: i.title,
      bodyText: i.bodyText,
      imageCount: i.imageCount ?? 0,
      vendor: i.vendor ?? null,
      hasBarcode: i.hasBarcode ?? false,
      hasCategory: i.hasCategory ?? false,
    })),
    policies.filter((p) => p.published).map((p) => p.type),
  )
}

/** Live products, and how many the agent controls leave visible. */
async function productVisibility(ctx: StoreContext, controls: AgentControls) {
  const live = and(eq(product.status, 'active'), notSystemTest)
  const [all] = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(product).where(live)
  const hidden =
    controls.hideTagged && controls.hiddenTags.length > 0
      ? sql`${product.tags} && ${sql.param(controls.hiddenTags)}::text[]`
      : sql`false`
  const inCollections =
    controls.visibility === 'collections'
      ? controls.collectionIds.length === 0
        ? sql`false`
        : sql`exists (select 1 from ${collectionProduct} where ${collectionProduct.productId} = ${product.id} and ${collectionProduct.collectionId} = any(${sql.param(controls.collectionIds)}::uuid[]))`
      : sql`true`
  const [visible] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(product)
    .where(and(live, inCollections, sql`not (${hidden})`))
  const [tagged] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(product)
    .where(and(live, hidden))
  return { active: all?.n ?? 0, visible: visible?.n ?? 0, hiddenByTag: tagged?.n ?? 0 }
}

export type ChannelOrder = {
  id: string
  number: number
  placedAt: Date
  totalPaise: number
  paymentStatus: string
  fulfillmentStatus: string
  customer: string | null
  channel: SalesChannelId
}

export type ChannelTotals = {
  orders: number
  revenuePaise: number
  prevOrders: number
  prevRevenuePaise: number
}

const EMPTY_TOTALS: ChannelTotals = {
  orders: 0,
  revenuePaise: 0,
  prevOrders: 0,
  prevRevenuePaise: 0,
}

/** Every channel order of the last two periods, newest first. */
async function channelOrders(ctx: StoreContext, now: Date): Promise<ChannelOrder[]> {
  const since = new Date(now.getTime() - 2 * CHANNEL_PERIOD_DAYS * DAY)
  const rows = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      placedAt: order.placedAt,
      totalPaise: order.totalPaise,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      attribution: order.attribution,
      name: customer.name,
      email: order.email,
    })
    .from(order)
    .leftJoin(customer, eq(customer.id, order.customerId))
    .where(
      and(
        ne(order.status, 'draft'),
        eq(order.isTest, false),
        isNotNull(order.attribution),
        gte(order.placedAt, since),
      ),
    )
    .orderBy(sql`${order.placedAt} desc`)
    .limit(MAX_ORDERS)
  const out: ChannelOrder[] = []
  for (const r of rows) {
    const channel = channelOfAttribution(r.attribution as MarketingAttribution | null)
    if (!channel) continue
    out.push({
      id: r.id,
      number: r.number,
      placedAt: r.placedAt,
      totalPaise: r.totalPaise,
      paymentStatus: r.paymentStatus,
      fulfillmentStatus: r.fulfillmentStatus,
      customer: r.name?.trim() || r.email || null,
      channel,
    })
  }
  return out
}

function totals(orders: readonly ChannelOrder[], now: Date): ChannelTotals {
  const cut = now.getTime() - CHANNEL_PERIOD_DAYS * DAY
  const t = { ...EMPTY_TOTALS }
  for (const o of orders) {
    if (o.placedAt.getTime() >= cut) {
      t.orders += 1
      t.revenuePaise += o.totalPaise
    } else {
      t.prevOrders += 1
      t.prevRevenuePaise += o.totalPaise
    }
  }
  return t
}

/** Revenue per day for this period and the one before, oldest first (the sales chart). */
function dailySeries(orders: readonly ChannelOrder[], now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const current = new Array<number>(CHANNEL_PERIOD_DAYS).fill(0)
  const previous = new Array<number>(CHANNEL_PERIOD_DAYS).fill(0)
  for (const o of orders) {
    const day = Math.floor(
      (today -
        Date.UTC(o.placedAt.getUTCFullYear(), o.placedAt.getUTCMonth(), o.placedAt.getUTCDate())) /
        DAY,
    )
    const [list, at] =
      day < CHANNEL_PERIOD_DAYS
        ? [current, CHANNEL_PERIOD_DAYS - 1 - day]
        : [previous, 2 * CHANNEL_PERIOD_DAYS - 1 - day]
    if (at >= 0) list[at] = (list[at] ?? 0) + o.totalPaise
  }
  return current.map((paise, i) => ({
    date: new Date(today - (CHANNEL_PERIOD_DAYS - 1 - i) * DAY).toISOString().slice(0, 10),
    paise,
    previousPaise: previous[i] ?? 0,
  }))
}

export type AgentRow = { agent: (typeof AI_AGENTS)[number]; state: ChannelState; orders: number }

export type AgenticOverview = {
  controls: AgentControls
  agents: AgentRow[]
  totals: ChannelTotals
  products: { active: number; visible: number; hiddenByTag: number }
  readiness: { score: number; issues: number }
  recent: ChannelOrder[]
}

/** Agentic sales → Overview. */
export async function loadAgenticOverview(
  ctx: StoreContext,
  now = new Date(),
): Promise<AgenticOverview> {
  const settings = await loadSettings(ctx)
  const [orders, products, readiness] = await Promise.all([
    channelOrders(ctx, now),
    productVisibility(ctx, settings.agents),
    loadCatalogReadiness(ctx),
  ])
  const agentOrders = orders.filter((o) => (AI_AGENTS as readonly string[]).includes(o.channel))
  const cut = now.getTime() - CHANNEL_PERIOD_DAYS * DAY
  return {
    controls: settings.agents,
    agents: AI_AGENTS.map((agent) => ({
      agent,
      state: channelState(settings, agent),
      orders: agentOrders.filter((o) => o.channel === agent && o.placedAt.getTime() >= cut).length,
    })),
    totals: totals(agentOrders, now),
    products,
    readiness: { score: readiness.score, issues: readiness.issues.length },
    recent: agentOrders.slice(0, 5),
  }
}

export type AgentControlsView = {
  controls: AgentControls
  agents: { agent: (typeof AI_AGENTS)[number]; state: ChannelState }[]
  products: { active: number; visible: number; hiddenByTag: number }
}

/** Agentic sales → Controls. */
export async function loadAgentControls(ctx: StoreContext): Promise<AgentControlsView> {
  const settings = await loadSettings(ctx)
  return {
    controls: settings.agents,
    agents: AI_AGENTS.map((agent) => ({ agent, state: channelState(settings, agent) })),
    products: await productVisibility(ctx, settings.agents),
  }
}

/** Save Agentic sales → Controls; connect requests stay as they are. */
export async function saveAgentControls(
  ctx: StoreContext,
  input: unknown,
): Promise<AgentControlsView> {
  const settings = await loadSettings(ctx)
  await saveSettings(ctx, { ...settings, agents: AgentControlsSchema.parse(input) })
  return loadAgentControls(ctx)
}

/**
 * Finish "Connect": the channel waits for approval with what the merchant chose to share.
 * Nothing is sent anywhere until the connection is approved.
 */
export async function requestChannel(
  ctx: StoreContext,
  input: ConnectRequest,
  now = new Date(),
): Promise<ChannelState> {
  const req = ConnectRequestSchema.parse(input)
  const settings = await loadSettings(ctx)
  const state: ChannelState = {
    ...NOT_CONNECTED,
    status: 'requested',
    requestedAt: now.toISOString(),
    shares: req.shares,
    account: req.account,
    catalog: req.catalog,
  }
  await saveSettings(ctx, { ...settings, channels: { ...settings.channels, [req.channel]: state } })
  return state
}

/** Withdraw a connect request (or, later, disconnect). */
export async function cancelChannel(
  ctx: StoreContext,
  channel: SalesChannelId,
): Promise<ChannelState> {
  const settings = await loadSettings(ctx)
  const { [channel]: _, ...rest } = settings.channels
  await saveSettings(ctx, { ...settings, channels: rest })
  return NOT_CONNECTED
}

export type SocialOverview = {
  channel: SocialChannel
  state: ChannelState
  totals: ChannelTotals
  series: { date: string; paise: number; previousPaise: number }[]
  activeProducts: number
  recent: ChannelOrder[]
}

/** Social media → one channel. */
export async function loadSocialOverview(
  ctx: StoreContext,
  channel: SocialChannel,
  now = new Date(),
): Promise<SocialOverview> {
  const settings = await loadSettings(ctx)
  const [orders, products] = await Promise.all([
    channelOrders(ctx, now),
    productVisibility(ctx, settings.agents),
  ])
  const mine = orders.filter((o) => o.channel === channel)
  return {
    channel,
    state: channelState(settings, channel),
    totals: totals(mine, now),
    series: dailySeries(mine, now),
    activeProducts: products.active,
    recent: mine.slice(0, 5),
  }
}
