import { and, asc, desc, eq, gte, isNotNull, like, sql } from 'drizzle-orm'
import { createDb } from './client'
import { marketingCampaign, marketingSession } from './marketing-schema'
import { type MarketingAttribution, order, store } from './schema'

/**
 * Local demo data for Growth: about 60 days of storefront sessions across Google, Instagram,
 * Facebook, WhatsApp, email, direct and organic search (some carrying an existing campaign),
 * and attribution on some existing orders, so the Growth charts have something to draw.
 *
 * Idempotent: sessions are recognised by their `demo-mkt-` visitor id and orders by a
 * `demo: true` key in their attribution, so a rerun (or `--clean`) replaces exactly these and
 * never touches an order that already had real attribution. Refuses to run in production or
 * against a database that is not on this machine.
 *
 *   bun run db:seed:demo:marketing          # replace the demo rows
 *   bun run db:seed:demo:marketing --clean  # remove them
 */

const DAYS = 60
const VISITOR_PREFIX = 'demo-mkt-'
/** Share of eligible orders given a session's attribution; the rest stay untracked. */
const ATTRIBUTED_SHARE = 0.7
const DAY_MS = 86_400_000
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

type Touch = {
  /** Relative weight among the day's sessions. */
  weight: number
  channel: string
  source: string | null
  medium: string | null
  referrer: string | null
  /** Campaign-carrying touches pick one of the store's campaigns. */
  campaign?: boolean
  landing: string[]
}

const TOUCHES: Touch[] = [
  {
    weight: 18,
    channel: 'direct',
    source: null,
    medium: null,
    referrer: null,
    landing: ['/', '/collections/all'],
  },
  {
    weight: 16,
    channel: 'organic_search',
    source: 'google',
    medium: 'organic',
    referrer: 'www.google.com',
    landing: ['/', '/collections/mousepads', '/collections/glasspads'],
  },
  {
    weight: 6,
    channel: 'organic_search',
    source: 'bing',
    medium: 'organic',
    referrer: 'www.bing.com',
    landing: ['/'],
  },
  {
    weight: 8,
    channel: 'paid_search',
    source: 'google',
    medium: 'cpc',
    referrer: 'www.google.com',
    landing: ['/collections/premium', '/collections/best-sellers'],
  },
  {
    weight: 14,
    channel: 'social',
    source: 'instagram',
    medium: 'social',
    referrer: 'l.instagram.com',
    landing: ['/', '/collections/best-sellers'],
  },
  {
    weight: 7,
    channel: 'paid_social',
    source: 'instagram',
    medium: 'paid_social',
    referrer: 'l.instagram.com',
    landing: ['/collections/glasspads'],
  },
  {
    weight: 8,
    channel: 'social',
    source: 'facebook',
    medium: 'social',
    referrer: 'm.facebook.com',
    landing: ['/', '/collections/all'],
  },
  {
    weight: 9,
    channel: 'whatsapp',
    source: 'whatsapp',
    medium: 'whatsapp',
    referrer: null,
    campaign: true,
    landing: ['/collections/best-sellers', '/'],
  },
  {
    weight: 9,
    channel: 'email',
    source: 'newsletter',
    medium: 'email',
    referrer: null,
    campaign: true,
    landing: ['/collections/premium', '/'],
  },
]

/** `utm_campaign` tags used when the store has no campaigns of its own. */
const UTM_CAMPAIGNS = ['festive-drop', 'restock-alert', 'weekend-deals']

type CampaignPick = { id: string; name: string; kind: string; startedAt: Date | null }

type SeedSession = {
  storeId: string
  visitorId: string
  channel: string
  source: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
  landingPath: string
  campaignId: string | null
  startedAt: Date
}

/** A small seeded generator so a rerun on the same day draws the same picture. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** Same rule as @commerce/core utmName: the campaign's `utm_campaign` tag. */
function utmName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

/** Throws unless this is a local, non-production database. Never prints the URLs. */
function assertLocalDatabase(env: Record<string, string | undefined>): void {
  if (env.NODE_ENV === 'production') {
    throw new Error('seed-demo-marketing refuses to run with NODE_ENV=production')
  }
  for (const key of ['DATABASE_URL', 'DATABASE_URL_OWNER']) {
    const value = env[key]
    if (!value) continue
    const host = hostOf(value)
    if (!host || !LOCAL_HOSTS.has(host)) {
      throw new Error(`seed-demo-marketing only runs against localhost (${key} is not local)`)
    }
  }
  if (!env.DATABASE_URL) throw new Error('seed-demo-marketing needs DATABASE_URL (localhost)')
}

function pick<T extends { weight: number }>(items: T[], rand: () => number): T {
  const total = items.reduce((n, i) => n + i.weight, 0)
  let r = rand() * total
  for (const item of items) {
    r -= item.weight
    if (r <= 0) return item
  }
  return items[items.length - 1] as T
}

function oneOf<T>(items: T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)] as T
}

/** Builds the sessions: a weekly rhythm, a gentle rise over the window and a mid-month spike. */
function buildSessions(
  storeId: string,
  campaigns: CampaignPick[],
  now: Date,
  rand: () => number,
): SeedSession[] {
  const out: SeedSession[] = []
  const start = now.getTime() - (DAYS - 1) * DAY_MS
  for (let d = 0; d < DAYS; d++) {
    const dayStart = new Date(start + d * DAY_MS)
    dayStart.setUTCHours(0, 0, 0, 0)
    const weekday = dayStart.getUTCDay()
    const weekend = weekday === 0 || weekday === 6 ? 1.35 : 1
    const rise = 0.7 + (d / DAYS) * 0.6
    const spike = d === 30 || d === 31 ? 1.8 : 1
    const count = Math.round((22 + rand() * 14) * weekend * rise * spike)
    for (let i = 0; i < count; i++) {
      const touch = pick(TOUCHES, rand)
      // Spread across 06:00-23:30 IST (00:30-18:00 UTC).
      const at = new Date(dayStart.getTime() + (30 + rand() * 1050) * 60_000)
      if (at.getTime() > now.getTime()) continue
      const live = campaigns.filter(
        (c) =>
          (c.kind === touch.channel || !c.kind) &&
          (!c.startedAt || c.startedAt.getTime() <= at.getTime()),
      )
      const tagged = touch.campaign === true && rand() < 0.6
      const campaign = tagged && live.length > 0 ? oneOf(live, rand) : null
      // A store with no campaigns yet still gets tracking-link campaigns (utm_campaign only).
      const tag = campaign ? utmName(campaign.name) : tagged ? oneOf(UTM_CAMPAIGNS, rand) : null
      out.push({
        storeId,
        visitorId: `${VISITOR_PREFIX}${d}-${i}-${Math.floor(rand() * 1e9).toString(36)}`,
        channel: touch.channel,
        source: touch.source,
        medium: touch.medium,
        campaign: tag,
        referrer: touch.referrer,
        landingPath: oneOf(touch.landing, rand),
        campaignId: campaign?.id ?? null,
        startedAt: at,
      })
    }
  }
  return out
}

async function seedDemoMarketing(
  ownerUrl: string,
  opts: { clean?: boolean; now?: Date } = {},
): Promise<{ sessions: number; orders: number }> {
  const db = createDb(ownerUrl)
  const now = opts.now ?? new Date()
  try {
    // The demo store, else the only store a fresh local database has.
    const [s] = await db
      .select({ id: store.id })
      .from(store)
      .orderBy(sql`${store.slug} = 'waimers' desc`, asc(store.slug))
      .limit(1)
    if (!s) throw new Error('seed the store first (bun run db:seed)')
    const storeId = s.id

    // Clear the previous run: demo sessions, and the attribution this seed put on orders.
    await db
      .delete(marketingSession)
      .where(
        and(
          eq(marketingSession.storeId, storeId),
          like(marketingSession.visitorId, `${VISITOR_PREFIX}%`),
        ),
      )
    await db
      .update(order)
      .set({ attribution: null })
      .where(and(eq(order.storeId, storeId), sql`${order.attribution} ->> 'demo' = 'true'`))
    if (opts.clean) return { sessions: 0, orders: 0 }

    const rand = mulberry32(Number(now.toISOString().slice(0, 10).replaceAll('-', '')))
    const campaigns: CampaignPick[] = (
      await db
        .select({
          id: marketingCampaign.id,
          name: marketingCampaign.name,
          kind: marketingCampaign.kind,
          startedAt: marketingCampaign.startedAt,
        })
        .from(marketingCampaign)
        .where(eq(marketingCampaign.storeId, storeId))
        .orderBy(desc(marketingCampaign.updatedAt))
        .limit(12)
    ).map((c) => ({ ...c, kind: c.kind as string }))

    const sessions = buildSessions(storeId, campaigns, now, rand)
    for (let i = 0; i < sessions.length; i += 500) {
      await db.insert(marketingSession).values(sessions.slice(i, i + 500))
    }

    // Orders in the window with no real attribution get a session's touch from earlier that
    // day (or the three days before), so attribution, campaign and source reports line up.
    const since = new Date(now.getTime() - DAYS * DAY_MS)
    const orders = await db
      .select({ id: order.id, placedAt: order.placedAt })
      .from(order)
      .where(
        and(
          eq(order.storeId, storeId),
          isNotNull(order.placedAt),
          gte(order.placedAt, since),
          sql`${order.attribution} is null`,
        ),
      )
    const sorted = [...sessions].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    let linked = 0
    for (const o of orders) {
      if (!o.placedAt || rand() > ATTRIBUTED_SHARE) continue
      const placed = o.placedAt.getTime()
      const before = sorted.filter(
        (x) => x.startedAt.getTime() <= placed && x.startedAt.getTime() > placed - 3 * DAY_MS,
      )
      if (before.length === 0) continue
      const touch = oneOf(before, rand)
      const attribution: MarketingAttribution & { demo: true } = {
        channel: touch.channel,
        ...(touch.source ? { source: touch.source } : {}),
        ...(touch.medium ? { medium: touch.medium } : {}),
        ...(touch.campaign ? { campaign: touch.campaign } : {}),
        ...(touch.referrer ? { referrer: touch.referrer } : {}),
        ...(touch.campaignId ? { campaignId: touch.campaignId } : {}),
        landing: touch.landingPath,
        at: touch.startedAt.toISOString(),
        demo: true,
      }
      await db.update(order).set({ attribution }).where(eq(order.id, o.id))
      linked += 1
    }
    return { sessions: sessions.length, orders: linked }
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  assertLocalDatabase(process.env)
  const url = process.env.DATABASE_URL_OWNER ?? process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  const clean = process.argv.includes('--clean')
  const result = await seedDemoMarketing(url, { clean })
  console.log(
    clean
      ? 'Removed the demo marketing sessions and order attribution.'
      : `Inserted ${result.sessions} demo sessions over ${DAYS} days and attributed ${result.orders} orders.`,
  )
}
