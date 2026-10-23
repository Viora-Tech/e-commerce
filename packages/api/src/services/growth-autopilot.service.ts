/**
 * Campaign Autopilot (Growth → Autopilot), v1 on the store's own channels. The merchant turns
 * it on and picks goals and caps; "Plan campaigns" reads the store's numbers, writes a draft
 * email campaign per goal (AI copy when the writer is on, a built-in template otherwise) and
 * keeps it as a proposal. Nothing is sent until the merchant approves a proposal, which
 * schedules the draft (creating its discount code first, within the merchant's cap) or, for
 * cart recovery, switches the abandoned-checkout automation on.
 *
 * Ad platforms (Meta, Google) are not connected yet; their budgets are not part of this.
 */
import {
  type CampaignCopy,
  CampaignCopySchema,
  campaignWriterContent,
  campaignWriterInstructions,
  clampCampaignCopy,
  generateStructured,
} from '@commerce/ai'
import {
  type AutopilotFacts,
  type AutopilotProposal,
  type AutopilotSettings,
  type AutopilotState,
  autopilotCampaignName,
  autopilotDiscountCode,
  autopilotState,
  type CampaignInput,
  createAutomationFromTemplate,
  createCampaign,
  DiscountInputSchema,
  deleteCampaign,
  type EmailBlock,
  type PlannedItem,
  parseEmailBlocks,
  planAutopilot,
  saveAutopilotState,
  scheduleCampaign,
  setAutomationStatus,
  templateMessage,
  trimProposals,
  visibleProposals,
} from '@commerce/core'
import {
  customerSegment,
  type Db,
  marketingCampaign,
  marketingMessage,
  media,
  product,
  productMedia,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { ORPCError } from '@orpc/server'
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import type { StoreScope } from '../procedures'
import { finishAiCall, startAiCall } from './ai/guard'
import { createDiscount } from './discount.service'
import { growthFacts } from './growth-recommendations.service'

const DAY_MS = 86_400_000
const NEW_PRODUCT_DAYS = 14
const NEW_PRODUCTS_SHOWN = 4
/** Customers with no order in this many days get the win-back campaign. */
const WIN_BACK_DAYS = 90
const WIN_BACK_SEGMENT = 'Autopilot: no order in 90 days'
/** Codes Autopilot creates stop working after this many days. */
const CODE_DAYS = 14

export type AutopilotProposalView = AutopilotProposal & {
  campaign: {
    name: string
    subject: string
    previewText: string
    status: string
    segmentName: string | null
  } | null
}

export type AutopilotView = {
  settings: AutopilotSettings
  plannedAt: string | null
  proposals: AutopilotProposalView[]
}

type NewProduct = {
  id: string
  title: string
  handle: string
  priceLabel: string
  imageUrl: string | null
}

async function newProducts(tx: StoreTx, now: Date): Promise<NewProduct[]> {
  const rows = await tx
    .select({
      id: product.id,
      title: product.title,
      handle: product.handle,
      price: sql<
        number | null
      >`(select min(${variant.pricePaise}) from ${variant} where ${variant.productId} = ${product.id})`,
      image: sql<
        string | null
      >`(select ${media.url} from ${productMedia} join ${media} on ${media.id} = ${productMedia.mediaId} where ${productMedia.productId} = ${product.id} order by ${productMedia.position} limit 1)`,
    })
    .from(product)
    .where(
      and(
        eq(product.status, 'active'),
        gte(product.createdAt, new Date(now.getTime() - NEW_PRODUCT_DAYS * DAY_MS)),
      ),
    )
    .orderBy(desc(product.createdAt))
    .limit(NEW_PRODUCTS_SHOWN)
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    handle: r.handle,
    priceLabel: r.price === null ? '' : formatMoney(Number(r.price)),
    imageUrl: r.image,
  }))
}

/** Campaigns scheduled, sending or sent in the last seven days, and their recipients. */
async function thisWeek(tx: StoreTx, now: Date) {
  const since = new Date(now.getTime() - 7 * DAY_MS)
  const [row] = await tx
    .select({
      campaigns: sql<number>`count(*)::int`,
      messages: sql<number>`coalesce(sum((select count(*) from ${marketingMessage} where ${marketingMessage.campaignId} = ${marketingCampaign.id})), 0)::int`,
    })
    .from(marketingCampaign)
    .where(
      and(
        inArray(marketingCampaign.status, ['scheduled', 'sending', 'sent']),
        sql`coalesce(${marketingCampaign.scheduledAt}, ${marketingCampaign.updatedAt}) >= ${since.toISOString()}::timestamptz`,
      ),
    )
  return { campaigns: row?.campaigns ?? 0, messages: row?.messages ?? 0 }
}

async function view(tx: StoreTx, state: AutopilotState): Promise<AutopilotView> {
  const proposals = visibleProposals(state.proposals)
  const ids = proposals.flatMap((p) => (p.campaignId ? [p.campaignId] : []))
  const campaigns = ids.length
    ? await tx
        .select({
          id: marketingCampaign.id,
          name: marketingCampaign.name,
          subject: marketingCampaign.subject,
          previewText: marketingCampaign.previewText,
          status: marketingCampaign.status,
          segmentName: customerSegment.name,
        })
        .from(marketingCampaign)
        .leftJoin(customerSegment, eq(customerSegment.id, marketingCampaign.segmentId))
        .where(inArray(marketingCampaign.id, ids))
    : []
  const byId = new Map(campaigns.map((c) => [c.id, c]))
  return {
    settings: state.settings,
    plannedAt: state.plannedAt,
    proposals: proposals.map((p) => {
      const c = p.campaignId ? byId.get(p.campaignId) : undefined
      return {
        ...p,
        campaign: c
          ? {
              name: c.name,
              subject: c.subject,
              previewText: c.previewText,
              status: c.status,
              segmentName: c.segmentName,
            }
          : null,
      }
    }),
  }
}

export async function autopilotView(tx: StoreTx, storeId: string): Promise<AutopilotView> {
  return view(tx, await autopilotState(tx, storeId))
}

export async function saveAutopilotSettings(
  tx: StoreTx,
  storeId: string,
  settings: AutopilotSettings,
): Promise<AutopilotView> {
  const current = await autopilotState(tx, storeId)
  return view(tx, await saveAutopilotState(tx, storeId, { ...current, settings }))
}

/** The win-back segment Autopilot uses, made the first time it is needed. */
async function winBackSegment(tx: StoreTx, storeId: string): Promise<string> {
  const [found] = await tx
    .select({ id: customerSegment.id })
    .from(customerSegment)
    .where(eq(customerSegment.name, WIN_BACK_SEGMENT))
  if (found) return found.id
  const [row] = await tx
    .insert(customerSegment)
    .values({
      storeId,
      name: WIN_BACK_SEGMENT,
      rules: {
        match: 'all',
        conditions: [{ field: 'last_order_days', op: 'gte', value: String(WIN_BACK_DAYS) }],
      },
    })
    .returning({ id: customerSegment.id })
  if (!row) throw new Error('Could not create the win-back segment')
  return row.id
}

function blocksFor(
  copy: CampaignCopy,
  products: NewProduct[],
  goal: PlannedItem['goal'],
): EmailBlock[] {
  const blocks: EmailBlock[] = [
    { id: 'ap-header', type: 'header' },
    { id: 'ap-text', type: 'text', heading: copy.heading, text: copy.body, align: 'left' },
  ]
  if (goal === 'new_products' && products.length) {
    blocks.push({ id: 'ap-products', type: 'products', heading: '', items: products })
  }
  blocks.push({ id: 'ap-button', type: 'button', label: copy.button, url: '{shop_url}' })
  return blocks
}

type Writer = (item: PlannedItem) => Promise<{ copy: CampaignCopy; ai: boolean }>

/** The AI writer when it is switched on for the store, the template when not or on any failure. */
function writer(
  context: { db: Db; scope: StoreScope },
  storeName: string,
  products: NewProduct[],
  signal?: AbortSignal,
): Writer {
  return async (item) => {
    const input = {
      goal: item.goal,
      festival: item.festival?.name ?? null,
      discountPercent: item.discountPercent,
      productTitles: item.goal === 'new_products' ? products.map((p) => p.title) : [],
    }
    const template = templateMessage({ ...input, storeName })
    try {
      const call = await startAiCall(context, 'productWriter')
      const { output, usage } = await generateStructured({
        runtime: call.runtime,
        model: call.model,
        schema: CampaignCopySchema,
        instructions: campaignWriterInstructions(storeName),
        content: campaignWriterContent(input),
        abortSignal: signal,
      })
      await finishAiCall(context.db, call, usage)
      const copy = clampCampaignCopy(output)
      if (!copy.subject || !copy.body) return { copy: template, ai: false }
      return { copy, ai: true }
    } catch {
      return { copy: template, ai: false }
    }
  }
}

/**
 * Plans the next campaigns: reads the store's numbers, writes a draft per goal that needs one
 * and stores each as a proposal waiting for approval. Returns the updated Autopilot view.
 */
export async function planAutopilotCampaigns(
  context: { db: Db; scope: StoreScope },
  now = new Date(),
  signal?: AbortSignal,
): Promise<AutopilotView> {
  const { storeId } = context.scope
  const gathered = await withStore(context.db, storeId, async (tx) => {
    const [state, facts, products, week, storeRow] = await Promise.all([
      autopilotState(tx, storeId),
      growthFacts(tx, storeId, now),
      newProducts(tx, now),
      thisWeek(tx, now),
      tx.select({ name: store.name }).from(store).where(eq(store.id, storeId)),
    ])
    const planFacts: AutopilotFacts = {
      now,
      subscribers: facts.subscribers,
      lapsedCustomers: facts.lapsedCustomers,
      abandoned: facts.abandoned,
      cartAutomation: facts.automations.abandoned_checkout,
      newProducts: products.length,
      campaignsThisWeek: week.campaigns,
      messagesThisWeek: week.messages,
    }
    return { state, planFacts, products, storeName: storeRow[0]?.name ?? '' }
  })
  if (!gathered.state.settings.enabled) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Turn Autopilot on first.' })
  }
  const items = planAutopilot(gathered.planFacts, gathered.state.settings, gathered.state.proposals)
  // Copy is written outside the transaction: model calls can take a while.
  const write = writer(context, gathered.storeName, gathered.products, signal)
  const written = await Promise.all(
    items.map(async (item) =>
      item.kind === 'campaign' ? { item, ...(await write(item)) } : { item, copy: null, ai: false },
    ),
  )

  return withStore(context.db, storeId, async (tx) => {
    const state = await autopilotState(tx, storeId)
    const created: AutopilotProposal[] = []
    for (const { item, copy, ai } of written) {
      let campaignId: string | null = null
      if (item.kind === 'campaign' && copy) {
        const input: CampaignInput = {
          kind: 'email',
          name: autopilotCampaignName(item),
          segmentId: item.goal === 'win_back' ? await winBackSegment(tx, storeId) : null,
          subject: copy.subject,
          previewText: copy.previewText,
          blocks: blocksFor(copy, gathered.products, item.goal),
          editor: 'blocks',
          design: null,
          whatsapp: null,
        }
        const row = await createCampaign(tx, storeId, input)
        if (!row) continue
        campaignId = row.id
      }
      created.push({
        id: crypto.randomUUID().slice(0, 12),
        goal: item.goal,
        kind: item.kind,
        campaignId,
        festival: item.festival?.id ?? null,
        sendAt: item.sendAt.toISOString(),
        audience: item.audience,
        discountPercent: item.discountPercent,
        numbers: item.numbers,
        aiWritten: ai,
        status: 'proposed',
        createdAt: now.toISOString(),
      })
    }
    const next = await saveAutopilotState(tx, storeId, {
      ...state,
      plannedAt: now.toISOString(),
      proposals: trimProposals([...created, ...state.proposals]),
    })
    return view(tx, next)
  })
}

function findProposal(state: AutopilotState, id: string): AutopilotProposal {
  const p = state.proposals.find((x) => x.id === id)
  if (!p) throw new ORPCError('NOT_FOUND', { message: 'This proposal is no longer there.' })
  if (p.status !== 'proposed') {
    throw new ORPCError('CONFLICT', { message: 'This proposal was already handled.' })
  }
  return p
}

async function withStatus(
  tx: StoreTx,
  storeId: string,
  state: AutopilotState,
  id: string,
  status: AutopilotProposal['status'],
) {
  const next = await saveAutopilotState(tx, storeId, {
    ...state,
    proposals: state.proposals.map((p) => (p.id === id ? { ...p, status } : p)),
  })
  return view(tx, next)
}

/** Adds the proposal's discount code (created now, within the merchant's cap) to its draft. */
async function addDiscount(tx: StoreTx, storeId: string, p: AutopilotProposal, cap: number) {
  const percent = Math.min(p.discountPercent, cap)
  if (!p.campaignId || percent <= 0) return
  const [c] = await tx
    .select({ blocks: marketingCampaign.blocks })
    .from(marketingCampaign)
    .where(eq(marketingCampaign.id, p.campaignId))
  if (!c) return
  const blocks = parseEmailBlocks(c.blocks)
  if (blocks.some((b) => b.type === 'discount')) return
  const code = autopilotDiscountCode(p.goal, percent, p.id)
  const now = new Date()
  await createDiscount(
    tx,
    storeId,
    DiscountInputSchema.parse({
      title: `Autopilot ${code}`,
      kind: 'code',
      code,
      method: 'percent',
      value: percent * 100,
      usagePerCustomer: 1,
      startsAt: now,
      endsAt: new Date(Math.max(Date.parse(p.sendAt), now.getTime()) + CODE_DAYS * DAY_MS),
    }),
  )
  const at = blocks.findIndex((b) => b.type === 'button')
  const block: EmailBlock = {
    id: 'ap-discount',
    type: 'discount',
    code,
    heading: `${percent}% off`,
    note: `Valid for ${CODE_DAYS} days, once per customer.`,
  }
  blocks.splice(at < 0 ? blocks.length : at, 0, block)
  await tx
    .update(marketingCampaign)
    .set({ blocks, updatedAt: now })
    .where(eq(marketingCampaign.id, p.campaignId))
}

/** Approve: schedule the draft for its send time, or switch cart reminders on. */
export async function approveAutopilotProposal(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<AutopilotView> {
  const state = await autopilotState(tx, storeId)
  const p = findProposal(state, id)
  if (p.kind === 'automation') {
    const facts = await growthFacts(tx, storeId)
    const current = facts.automations.abandoned_checkout
    const automationId =
      current.status === 'missing'
        ? (await createAutomationFromTemplate(tx, storeId, 'abandoned_checkout'))?.id
        : current.id
    if (!automationId) throw new ORPCError('NOT_FOUND', { message: 'Automation template missing' })
    await setAutomationStatus(tx, automationId, 'active')
    return withStatus(tx, storeId, state, id, 'scheduled')
  }
  if (!p.campaignId) throw new ORPCError('NOT_FOUND', { message: 'Campaign missing' })
  await addDiscount(tx, storeId, p, state.settings.maxDiscountPercent)
  const row = await scheduleCampaign(tx, p.campaignId, { at: new Date(p.sendAt) }).catch(
    (err: unknown) => {
      throw new ORPCError('CONFLICT', {
        message: err instanceof Error ? err.message : 'The campaign could not be scheduled.',
      })
    },
  )
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'The draft campaign was deleted.' })
  return withStatus(tx, storeId, state, id, 'scheduled')
}

/** Dismiss: the proposal is kept as dismissed and its unsent draft is deleted. */
export async function dismissAutopilotProposal(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<AutopilotView> {
  const state = await autopilotState(tx, storeId)
  const p = findProposal(state, id)
  if (p.campaignId) await deleteCampaign(tx, p.campaignId).catch(() => false)
  return withStatus(tx, storeId, state, id, 'dismissed')
}
