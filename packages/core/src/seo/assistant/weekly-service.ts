/** SOURCE OF TRUTH: sending the weekly SEO email — WHAT: on Monday from 9:00 IST, for a store with Google Search Console connected, claims the week (one `seo_weekly_snapshot` row), compares each page's Google position with last week's snapshot, and emails the store owner(s) the pages that moved and the top three suggestions / WHY: the worker sweeps every few minutes; the unique (store, week) row makes overlapping sweeps and restarts send each week once. Off unless Search Console is connected; the store can switch the message off in Settings → Notifications */
import { formatInZone } from '@commerce/dates'
import { authSchema, role, seoWeeklySnapshot, store, storeMember } from '@commerce/db'
import type { SeoWeeklyEmail, TemplateData } from '@commerce/notifications'
import { and, desc, eq, lt } from 'drizzle-orm'
import type { StoreContext } from '../../context'
import { type AlertOptions, deliverToMember } from '../../member-account/alerts'
import { reportDue, reportPeriod } from '../../member-account/report-periods'
import { SEO_ASSISTANT_MAX_ROWS, type SeoAssistantResource } from './opportunity'
import { searchConsoleConnected, seoAssistantRows } from './service'
import { type SeoSnapshot, seoSnapshot, seoWeekly, weeklyHasNews } from './weekly'

export const SEO_WEEKLY_TEMPLATE = 'staff_seo_weekly' as const

const ADMIN_PATH: Record<SeoAssistantResource, (id: string) => string> = {
  product: (id) => `/products/${encodeURIComponent(id)}`,
  collection: (id) => `/products/collections/${encodeURIComponent(id)}`,
  page: (id) => `/online-store/pages/${encodeURIComponent(id)}`,
}

/** The admin path of Online store › SEO › Search opportunities. */
export const SEO_ASSISTANT_ADMIN_PATH = '/online-store/seo/assistant'

const count = (n: number) => n.toLocaleString('en-IN')

/** The store's active owners, with their sign-in email. */
async function owners(ctx: StoreContext): Promise<{ email: string; phone: string | null }[]> {
  return ctx.tx
    .select({ email: authSchema.user.email, phone: authSchema.user.phone })
    .from(storeMember)
    .innerJoin(role, eq(role.id, storeMember.roleId))
    .innerJoin(authSchema.user, eq(authSchema.user.id, storeMember.userId))
    .where(
      and(
        eq(storeMember.storeId, ctx.storeId),
        eq(storeMember.status, 'active'),
        eq(role.slug, 'owner'),
      ),
    )
}

export type SeoWeeklyResult = 'not_due' | 'not_connected' | 'already_sent' | 'quiet' | 'sent'

/**
 * This week's SEO email for one store, when it is due. The week is claimed first (insert, do
 * nothing on conflict), so only one sweep sends it; the snapshot is saved even in a quiet week so
 * next week compares against it.
 */
export async function sendSeoWeeklyEmail(
  ctx: StoreContext,
  opts: AlertOptions & { now?: Date | undefined },
): Promise<SeoWeeklyResult> {
  const now = opts.now ?? new Date()
  if (!reportDue('weekly', now)) return 'not_due'
  const conn = await searchConsoleConnected(ctx.tx, ctx.storeId)
  if (conn.state !== 'connected') return 'not_connected'
  const weekKey = reportPeriod('weekly', now).key

  const rows = (await seoAssistantRows(ctx.tx, ctx.storeId)).slice(0, SEO_ASSISTANT_MAX_ROWS)
  const claimed = await ctx.tx
    .insert(seoWeeklySnapshot)
    .values({ storeId: ctx.storeId, weekKey, pages: seoSnapshot(rows), createdAt: now })
    .onConflictDoNothing({ target: [seoWeeklySnapshot.storeId, seoWeeklySnapshot.weekKey] })
    .returning({ id: seoWeeklySnapshot.id })
  const claim = claimed[0]
  if (!claim) return 'already_sent'

  const [previous] = await ctx.tx
    .select({ pages: seoWeeklySnapshot.pages })
    .from(seoWeeklySnapshot)
    .where(and(eq(seoWeeklySnapshot.storeId, ctx.storeId), lt(seoWeeklySnapshot.weekKey, weekKey)))
    .orderBy(desc(seoWeeklySnapshot.weekKey))
    .limit(1)
  const last: SeoSnapshot | null = previous?.pages ?? null
  const week = seoWeekly(rows, last)
  if (!weeklyHasNews(week)) return 'quiet'

  const admin = opts.adminUrl.replace(/\/+$/, '')
  const url = `${admin}${SEO_ASSISTANT_ADMIN_PATH}`
  const seo: SeoWeeklyEmail = {
    periodLabel: `Week of ${formatInZone(now, { day: 'numeric', month: 'long' }, { locale: 'en-US' })}`,
    clicksLabel: count(week.clicks),
    impressionsLabel: count(week.impressions),
    sinceLastWeek: week.sinceLastWeek,
    up: week.up.map((m) => ({ ...m, url: `${admin}${ADMIN_PATH[m.resource](m.id)}` })),
    down: week.down.map((m) => ({ ...m, url: `${admin}${ADMIN_PATH[m.resource](m.id)}` })),
    suggestions: week.suggestions.map((s) => ({ ...s, url })),
    url,
  }
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const data: TemplateData = {
    storeName: s?.name ?? '',
    customerName: '',
    totalLabel: '',
    lines: [],
    paymentMethodLabel: '',
    actionUrl: url,
    seoWeekly: seo,
  }
  let sent = false
  for (const owner of await owners(ctx)) {
    const results = await deliverToMember(
      ctx,
      SEO_WEEKLY_TEMPLATE,
      owner,
      { email: true, whatsapp: false, push: false },
      data,
      opts,
    )
    if (results.length) sent = true
  }
  await ctx.tx
    .update(seoWeeklySnapshot)
    .set({ sentAt: sent ? now : null })
    .where(eq(seoWeeklySnapshot.id, claim.id))
  return sent ? 'sent' : 'quiet'
}
