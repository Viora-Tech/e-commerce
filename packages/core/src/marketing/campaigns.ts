import {
  customerSegment,
  type MarketingCampaignStatus,
  marketingCampaign,
  marketingMessage,
  order,
  type StoreTx,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import { campaignAudience } from './audience'
import { type CampaignInput, campaignProblems } from './campaign-input'
import { applyMergeTags, type EmailBlock, parseEmailBlocks, renderMarketingEmail } from './email'
import {
  firstName,
  type MarketingDeps,
  marketingChannels,
  sendMarketingEmail,
  sendMarketingWhatsapp,
  storeSender,
} from './send'
import type { WhatsappTemplateRef } from './whatsapp'

export class CampaignLocked extends Error {
  constructor(status: string) {
    super(`A ${status} campaign cannot be changed. Duplicate it to send again.`)
    this.name = 'CampaignLocked'
  }
}

export class CampaignNotReady extends Error {
  constructor(readonly problems: string[]) {
    super(`The campaign is not ready: ${problems.join(', ')}`)
    this.name = 'CampaignNotReady'
  }
}

/** How many recipients one batch job sends before it hands back to the queue. */
export const CAMPAIGN_BATCH_SIZE = 50
const INSERT_CHUNK = 500

export type CampaignRow = typeof marketingCampaign.$inferSelect

export type CampaignStats = {
  recipients: number
  sent: number
  failed: number
  queued: number
  opened: number
  clicked: number
  orders: number
  revenuePaise: number
}

const EMPTY_STATS: CampaignStats = {
  recipients: 0,
  sent: 0,
  failed: 0,
  queued: 0,
  opened: 0,
  clicked: 0,
  orders: 0,
  revenuePaise: 0,
}

function values(storeId: string, input: CampaignInput) {
  return {
    storeId,
    kind: input.kind,
    name: input.name,
    segmentId: input.segmentId,
    subject: input.kind === 'email' ? input.subject : '',
    previewText: input.kind === 'email' ? input.previewText : '',
    blocks: input.kind === 'email' ? input.blocks : [],
    whatsapp: input.kind === 'whatsapp' ? input.whatsapp : null,
  }
}

export async function createCampaign(tx: StoreTx, storeId: string, input: CampaignInput) {
  const [row] = await tx.insert(marketingCampaign).values(values(storeId, input)).returning()
  return row ?? null
}

export async function getCampaign(tx: StoreTx, id: string): Promise<CampaignRow | null> {
  const [row] = await tx.select().from(marketingCampaign).where(eq(marketingCampaign.id, id))
  return row ?? null
}

/** Drafts are editable; anything that has been scheduled must be unscheduled first. */
export async function updateCampaign(
  tx: StoreTx,
  storeId: string,
  id: string,
  input: CampaignInput,
) {
  const current = await getCampaign(tx, id)
  if (!current) return null
  if (current.status !== 'draft') throw new CampaignLocked(current.status)
  const [row] = await tx
    .update(marketingCampaign)
    .set({ ...values(storeId, input), kind: current.kind, updatedAt: new Date() })
    .where(eq(marketingCampaign.id, id))
    .returning()
  return row ?? null
}

export async function deleteCampaign(tx: StoreTx, id: string) {
  const current = await getCampaign(tx, id)
  if (!current) return false
  if (current.status === 'sending' || current.status === 'sent') {
    throw new CampaignLocked(current.status)
  }
  await tx.delete(marketingCampaign).where(eq(marketingCampaign.id, id))
  return true
}

export async function duplicateCampaign(tx: StoreTx, storeId: string, id: string, copyOf: string) {
  const c = await getCampaign(tx, id)
  if (!c) return null
  const [row] = await tx
    .insert(marketingCampaign)
    .values({
      storeId,
      kind: c.kind,
      name: `${copyOf} ${c.name}`.slice(0, 120),
      segmentId: c.segmentId,
      subject: c.subject,
      previewText: c.previewText,
      blocks: c.blocks,
      whatsapp: c.whatsapp,
    })
    .returning()
  return row ?? null
}

/**
 * Schedule for `at`, or for now. The worker's next tick materialises the
 * audience and starts sending; until then the merchant can unschedule.
 */
export async function scheduleCampaign(
  tx: StoreTx,
  id: string,
  opts: { at?: Date | null | undefined; variableCount?: number | undefined; now?: Date } = {},
) {
  const c = await getCampaign(tx, id)
  if (!c) return null
  if (c.status !== 'draft') throw new CampaignLocked(c.status)
  const problems = campaignProblems({
    kind: c.kind,
    subject: c.subject,
    blocks: parseEmailBlocks(c.blocks),
    whatsapp: c.whatsapp,
    variableCount: opts.variableCount,
  })
  if (problems.length) throw new CampaignNotReady(problems)
  const now = opts.now ?? new Date()
  const at = opts.at && opts.at > now ? opts.at : now
  const [row] = await tx
    .update(marketingCampaign)
    .set({ status: 'scheduled', scheduledAt: at, updatedAt: now })
    .where(eq(marketingCampaign.id, id))
    .returning()
  return row ?? null
}

/** Unschedules a scheduled campaign, or stops one mid-send (unsent recipients are skipped). */
export async function cancelCampaign(tx: StoreTx, id: string) {
  const c = await getCampaign(tx, id)
  if (!c) return null
  if (c.status === 'scheduled') {
    const [row] = await tx
      .update(marketingCampaign)
      .set({ status: 'draft', scheduledAt: null, updatedAt: new Date() })
      .where(eq(marketingCampaign.id, id))
      .returning()
    return row ?? null
  }
  if (c.status !== 'sending') throw new CampaignLocked(c.status)
  await tx
    .update(marketingMessage)
    .set({ status: 'skipped', error: 'campaign cancelled' })
    .where(and(eq(marketingMessage.campaignId, id), eq(marketingMessage.status, 'queued')))
  const [row] = await tx
    .update(marketingCampaign)
    .set({ status: 'cancelled', finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(marketingCampaign.id, id))
    .returning()
  return row ?? null
}

/**
 * Campaigns whose time has come: the audience is resolved now (consent and
 * unsubscribes as they stand at send time), one queued message per
 * recipient, and the campaign moves to `sending`. Returns the ids to batch.
 */
export async function startDueCampaigns(
  tx: StoreTx,
  storeId: string,
  now: Date = new Date(),
): Promise<string[]> {
  const due = await tx
    .select()
    .from(marketingCampaign)
    .where(and(eq(marketingCampaign.status, 'scheduled'), lte(marketingCampaign.scheduledAt, now)))
    .for('update', { skipLocked: true })
  for (const c of due) {
    const audience = await campaignAudience(tx, { kind: c.kind, segmentId: c.segmentId, now })
    for (let i = 0; i < audience.length; i += INSERT_CHUNK) {
      await tx
        .insert(marketingMessage)
        .values(
          audience.slice(i, i + INSERT_CHUNK).map((m) => ({
            storeId,
            campaignId: c.id,
            customerId: m.customerId,
            channel: c.kind,
            to: m.to,
          })),
        )
        .onConflictDoNothing()
    }
    const empty = audience.length === 0
    await tx
      .update(marketingCampaign)
      .set({
        status: empty ? 'sent' : 'sending',
        startedAt: now,
        finishedAt: empty ? now : null,
        audienceCount: audience.length,
        updatedAt: now,
      })
      .where(eq(marketingCampaign.id, c.id))
  }
  const sending = await tx
    .select({ id: marketingCampaign.id })
    .from(marketingCampaign)
    .where(eq(marketingCampaign.status, 'sending'))
  return sending.map((r) => r.id)
}

type Recipient = { id: string; to: string; customerId: string | null; name: string | null }

/**
 * Sends the next batch of queued recipients for one campaign. Rows are
 * locked with SKIP LOCKED, so two workers never send the same message; a
 * failure is recorded per recipient and does not stop the batch. When no
 * queued recipient is left the campaign is marked sent.
 */
export async function sendCampaignBatch(
  tx: StoreTx,
  storeId: string,
  deps: MarketingDeps,
  campaignId: string,
  limit: number = CAMPAIGN_BATCH_SIZE,
): Promise<{ sent: number; failed: number; done: boolean }> {
  const c = await getCampaign(tx, campaignId)
  if (c?.status !== 'sending') return { sent: 0, failed: 0, done: true }
  const batch: Recipient[] = await tx
    .select({
      id: marketingMessage.id,
      to: marketingMessage.to,
      customerId: marketingMessage.customerId,
      name: sql<
        string | null
      >`(select name from customer where customer.id = ${marketingMessage.customerId})`,
    })
    .from(marketingMessage)
    .where(and(eq(marketingMessage.campaignId, campaignId), eq(marketingMessage.status, 'queued')))
    .orderBy(asc(marketingMessage.id))
    .limit(limit)
    .for('update', { skipLocked: true })

  const channels = await marketingChannels(tx, storeId, deps)
  const channel = c.kind === 'email' ? channels.email : channels.whatsapp
  const sender = await storeSender(tx, storeId)
  let sent = 0
  let failed = 0
  for (const r of batch) {
    // Consent can be withdrawn between scheduling and this batch.
    const [still] = await tx.execute<{ ok: boolean }>(sql`
      select (unsubscribed_at is null and ${c.kind === 'email' ? sql`accepts_marketing` : sql`accepts_whatsapp`}) as ok
      from customer where id = ${r.customerId}`)
    if (r.customerId && still && !still.ok) {
      await tx
        .update(marketingMessage)
        .set({ status: 'skipped', error: 'unsubscribed' })
        .where(eq(marketingMessage.id, r.id))
      continue
    }
    if (!channel) {
      await tx
        .update(marketingMessage)
        .set({ status: 'failed', error: `no ${c.kind} channel is enabled` })
        .where(eq(marketingMessage.id, r.id))
      failed += 1
      continue
    }
    const merge = {
      first_name: firstName(r.name),
      name: r.name ?? '',
      store_name: sender.storeName,
      shop_url: deps.storefrontUrl,
    }
    const result =
      c.kind === 'email'
        ? await sendMarketingEmail(tx, storeId, deps, channel, sender, {
            messageId: r.id,
            to: r.to,
            customerId: r.customerId,
            subject: applyMergeTags(c.subject, merge),
            previewText: c.previewText,
            blocks: parseEmailBlocks(c.blocks),
            merge,
            utmCampaign: utmName(c.name),
          })
        : await sendMarketingWhatsapp(
            tx,
            channel,
            { messageId: r.id, to: r.to, template: c.whatsapp as WhatsappTemplateRef, merge },
            applyMergeTags,
          )
    if (result.ok) sent += 1
    else failed += 1
  }

  const [left] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(marketingMessage)
    .where(and(eq(marketingMessage.campaignId, campaignId), eq(marketingMessage.status, 'queued')))
  const done = (left?.n ?? 0) === 0
  if (done) {
    const [outcome] = await tx
      .select({ sent: sql<number>`count(*) filter (where status = 'sent')::int` })
      .from(marketingMessage)
      .where(eq(marketingMessage.campaignId, campaignId))
    const status: MarketingCampaignStatus =
      (outcome?.sent ?? 0) === 0 && c.audienceCount > 0 ? 'failed' : 'sent'
    await tx
      .update(marketingCampaign)
      .set({ status, finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(marketingCampaign.id, campaignId))
  }
  return { sent, failed, done }
}

/** `Diwali Drop 2026` becomes `diwali-drop-2026` for utm_campaign. */
export function utmName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'campaign'
  )
}

/** Delivery, engagement and attributed orders per campaign. */
export async function campaignStats(
  tx: StoreTx,
  ids: string[],
): Promise<Map<string, CampaignStats>> {
  const out = new Map<string, CampaignStats>()
  if (ids.length === 0) return out
  const messages = await tx
    .select({
      id: marketingMessage.campaignId,
      recipients: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${marketingMessage.status} = 'sent')::int`,
      failed: sql<number>`count(*) filter (where ${marketingMessage.status} = 'failed')::int`,
      queued: sql<number>`count(*) filter (where ${marketingMessage.status} = 'queued')::int`,
      opened: sql<number>`count(${marketingMessage.openedAt})::int`,
      clicked: sql<number>`count(${marketingMessage.clickedAt})::int`,
    })
    .from(marketingMessage)
    .where(inArray(marketingMessage.campaignId, ids))
    .groupBy(marketingMessage.campaignId)
  const orders = await tx
    .select({
      id: sql<string>`${order.attribution} ->> 'campaignId'`,
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${order.totalPaise}), 0)::int`,
    })
    .from(order)
    .where(
      and(
        sql`${order.attribution} ->> 'campaignId' in (${sql.join(
          ids.map((i) => sql`${i}`),
          sql`, `,
        )})`,
        sql`${order.status} not in ('draft', 'cancelled')`,
      ),
    )
    .groupBy(sql`${order.attribution} ->> 'campaignId'`)
  for (const id of ids) out.set(id, { ...EMPTY_STATS })
  for (const m of messages) {
    if (!m.id) continue
    const s = out.get(m.id)
    if (s) Object.assign(s, { ...m, id: undefined })
  }
  for (const o of orders) {
    const s = out.get(o.id)
    if (s) Object.assign(s, { orders: o.orders, revenuePaise: o.revenue })
  }
  return out
}

export type CampaignListItem = CampaignRow & { stats: CampaignStats; segmentName: string | null }

export async function listCampaigns(
  tx: StoreTx,
  input: { kind?: 'email' | 'whatsapp' | undefined } = {},
): Promise<CampaignListItem[]> {
  const rows = await tx
    .select({ campaign: marketingCampaign, segmentName: customerSegment.name })
    .from(marketingCampaign)
    .leftJoin(customerSegment, eq(customerSegment.id, marketingCampaign.segmentId))
    .where(input.kind ? eq(marketingCampaign.kind, input.kind) : undefined)
    .orderBy(desc(marketingCampaign.createdAt))
  const stats = await campaignStats(
    tx,
    rows.map((r) => r.campaign.id),
  )
  return rows.map((r) => ({
    ...r.campaign,
    segmentName: r.segmentName,
    stats: stats.get(r.campaign.id) ?? { ...EMPTY_STATS },
  }))
}

/** Recipients a campaign would reach right now, for the editor's audience line. */
export async function audienceSize(
  tx: StoreTx,
  input: { kind: 'email' | 'whatsapp'; segmentId: string | null },
): Promise<number> {
  return (await campaignAudience(tx, input)).length
}

/**
 * A test send to the merchant: same rendering, no tracking, no unsubscribe
 * (the address is not a customer), subject marked as a test.
 */
export async function testSendCampaignEmail(
  tx: StoreTx,
  storeId: string,
  deps: MarketingDeps,
  input: {
    to: string
    subject: string
    previewText: string
    blocks: EmailBlock[]
    testPrefix: string
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const channels = await marketingChannels(tx, storeId, deps)
  if (!channels.email) return { ok: false, error: 'no email channel is enabled' }
  const sender = await storeSender(tx, storeId)
  const merge = {
    first_name: 'Asha',
    name: 'Asha Menon',
    store_name: sender.storeName,
    shop_url: deps.storefrontUrl,
  }
  const { html, text } = renderMarketingEmail(input.blocks, {
    storeName: sender.storeName,
    storeAddress: sender.storeAddress,
    shopUrl: deps.storefrontUrl,
    previewText: input.previewText,
    merge,
  })
  const send = channels.email.sendMarketing
  if (!send) return { ok: false, error: 'the email channel cannot send marketing' }
  const r = await send.call(channels.email, {
    kind: 'email',
    to: { email: input.to },
    subject: `${input.testPrefix} ${applyMergeTags(input.subject, merge)}`.trim(),
    html,
    text,
  })
  return r.ok ? { ok: true } : { ok: false, error: r.error }
}
