import {
  audienceSize,
  type CampaignOrder,
  type CampaignStats,
  campaignOrders,
  campaignStats,
  getCampaign,
  type MarketingDeps,
  marketingChannels,
  storefrontOriginFor,
  storeSender,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { customerSegment, type StoreTx } from '@commerce/db'
import type { ChannelTemplate } from '@commerce/notifications'
import { asc, eq } from 'drizzle-orm'

export async function marketingDeps(
  tx: StoreTx,
  storeId: string,
  env: { settingsSecret: string; storefrontUrl: string },
): Promise<MarketingDeps> {
  return {
    registry: (await registriesForStore(tx, storeId)).notifications,
    settingsSecret: env.settingsSecret,
    // The store's own domain; `env.storefrontUrl` (STOREFRONT_URL) only when it has none.
    storefrontUrl: await storefrontOriginFor(tx, storeId, env.storefrontUrl),
  }
}

export type CampaignDetail = NonNullable<Awaited<ReturnType<typeof getCampaign>>> & {
  stats: CampaignStats
  segmentName: string | null
  /** The newest orders credited to it, for "Orders from this campaign". */
  recentOrders: CampaignOrder[]
}

export async function campaignDetail(tx: StoreTx, id: string): Promise<CampaignDetail | null> {
  const c = await getCampaign(tx, id)
  if (!c) return null
  const [stats, seg, recentOrders] = await Promise.all([
    campaignStats(tx, [id]),
    c.segmentId
      ? tx
          .select({ name: customerSegment.name })
          .from(customerSegment)
          .where(eq(customerSegment.id, c.segmentId))
      : [],
    campaignOrders(tx, id),
  ])
  return {
    ...c,
    stats: stats.get(id) as CampaignStats,
    segmentName: seg[0]?.name ?? null,
    recentOrders,
  }
}

export type MarketingSetup = {
  /** Label of the channel that will carry email, or null when none can. */
  email: string | null
  whatsapp: string | null
  storeName: string
  storefrontUrl: string
  segments: { id: string; name: string }[]
}

/** What the editors need: channels that can carry marketing, the sender and the segments. */
export async function marketingSetup(
  tx: StoreTx,
  storeId: string,
  deps: MarketingDeps,
): Promise<MarketingSetup> {
  const [c, sender, segments] = await Promise.all([
    marketingChannels(tx, storeId, deps),
    storeSender(tx, storeId),
    tx
      .select({ id: customerSegment.id, name: customerSegment.name })
      .from(customerSegment)
      .orderBy(asc(customerSegment.name)),
  ])
  return {
    email: c.email?.label ?? null,
    whatsapp: c.whatsapp?.label ?? null,
    storeName: sender.storeName,
    storefrontUrl: deps.storefrontUrl,
    segments,
  }
}

export type TemplatesResult =
  | { ok: true; templates: ChannelTemplate[] }
  | { ok: false; reason: 'no_channel' | 'not_listable' | 'error'; message?: string }

/** Approved WhatsApp templates from the store's WhatsApp channel. */
export async function whatsappTemplates(
  tx: StoreTx,
  storeId: string,
  deps: MarketingDeps,
): Promise<TemplatesResult> {
  const { whatsapp } = await marketingChannels(tx, storeId, deps)
  if (!whatsapp) return { ok: false, reason: 'no_channel' }
  if (!whatsapp.listTemplates) return { ok: false, reason: 'not_listable' }
  try {
    const templates = await whatsapp.listTemplates()
    return templates.length ? { ok: true, templates } : { ok: false, reason: 'not_listable' }
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

export { audienceSize }
