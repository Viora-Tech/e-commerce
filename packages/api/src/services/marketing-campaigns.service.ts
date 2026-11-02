import {
  audienceSize,
  type CampaignOrder,
  type CampaignStats,
  campaignOrders,
  campaignStats,
  type EmailBrand,
  getCampaign,
  liveThemeSettings,
  type MarketingDeps,
  marketingChannels,
  storefrontOriginFor,
  storeSender,
} from '@commerce/core'
import { compileEmailDesign } from '@commerce/core/email-design-compile'
import { productCards } from '@commerce/core/inbox/server'
import { type EmailProductCard, emailStarters, type StarterContext } from '@commerce/core/marketing'
import { registriesForStore } from '@commerce/core/registries'
import { customerSegment, product, type StoreTx } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { ChannelTemplate } from '@commerce/notifications'
import { asc, desc, eq } from 'drizzle-orm'
import { type CampaignReport, campaignReport } from './growth-report.service'

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
  /** Funnel, rates, buyer split and landing pages; null until sending starts. */
  report: CampaignReport | null
}

export async function campaignDetail(tx: StoreTx, id: string): Promise<CampaignDetail | null> {
  const c = await getCampaign(tx, id)
  if (!c) return null
  const [stats, seg, recentOrders, report] = await Promise.all([
    campaignStats(tx, [id]),
    c.segmentId
      ? tx
          .select({ name: customerSegment.name })
          .from(customerSegment)
          .where(eq(customerSegment.id, c.segmentId))
      : [],
    campaignOrders(tx, id),
    c.startedAt ? campaignReport(tx, c) : null,
  ])
  return {
    ...c,
    stats: stats.get(id) as CampaignStats,
    segmentName: seg[0]?.name ?? null,
    recentOrders,
    report,
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

/** A root-relative media URL (`/media/...`) made absolute, since an inbox has no base URL. */
function absolute(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return url.startsWith('/') ? `${origin.replace(/\/$/, '')}${url}` : null
}

/** The live theme's logo, first colour scheme and social profiles, for the visual email builder. */
export async function emailBrand(
  tx: StoreTx,
  storeId: string,
  storefrontUrl: string,
): Promise<EmailBrand> {
  const [theme, sender] = await Promise.all([
    liveThemeSettings(tx, storeId),
    storeSender(tx, storeId),
  ])
  const scheme = theme.schemes[0]
  return {
    storeName: sender.storeName,
    logoUrl: absolute(theme.brand.logo?.url, storefrontUrl),
    logoWidth: theme.brand.logoWidth,
    colours: {
      background: scheme?.background ?? '#ffffff',
      text: scheme?.text ?? '#1a1a1a',
      muted: scheme?.textMuted ?? '#6b6b6b',
      button: scheme?.button ?? '#1a1a1a',
      buttonText: scheme?.buttonText ?? '#ffffff',
    },
    social: theme.social.links.map((l) => ({ platform: l.platform, url: l.url })),
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

/** The newest active products with a photo, as builder product cards, for the ready-made templates. */
async function starterProducts(tx: StoreTx, origin: string): Promise<EmailProductCard[]> {
  const rows = await tx
    .select({ id: product.id })
    .from(product)
    .where(eq(product.status, 'active'))
    .orderBy(desc(product.createdAt))
    .limit(12)
  const cards = await productCards(
    tx,
    rows.map((r) => r.id),
  )
  return rows
    .map((r) => cards[r.id])
    .filter((c): c is NonNullable<typeof c> => Boolean(c?.imageUrl))
    .slice(0, 6)
    .map((c) => ({
      title: c.title,
      handle: c.handle,
      imageUrl: absolute(c.imageUrl, origin),
      priceLabel: c.minPricePaise == null ? '' : formatMoney(c.minPricePaise),
    }))
}

/**
 * Every ready-made template built for this store (its logo, colour and newest products), with
 * the compiled HTML for the gallery's thumbnails. The builder opens a pick from its MJML.
 */
export async function emailStarterGallery(
  tx: StoreTx,
  storeId: string,
  storefrontUrl: string,
  labels: StarterContext['labels'],
) {
  const [brand, items] = await Promise.all([
    emailBrand(tx, storeId, storefrontUrl),
    starterProducts(tx, storefrontUrl),
  ])
  const starters = emailStarters({ brand, products: items, labels })
  return Promise.all(
    starters.map(async (s) => ({ ...s, html: (await compileEmailDesign(s.mjml)).html })),
  )
}
