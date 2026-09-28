/** SOURCE OF TRUTH: customer privacy settings and cookie consent records — WHAT: read and save `store.preferences.customerPrivacy` (banner text, banner version, data request window), "ask everyone again", and the proof row written each time a shopper answers the cookie banner / WHY: Settings → Customer privacy, the storefront banner and the consent API share one reader and writer */
import { cookieConsent, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type PrivacyActor, recordPrivacyEvent } from './audit'
import {
  type CustomerPrivacySettings,
  CustomerPrivacySettingsSchema,
  parseCustomerPrivacySettings,
} from './client'

export async function loadCustomerPrivacySettings(
  ctx: StoreContext,
): Promise<CustomerPrivacySettings> {
  const [s] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseCustomerPrivacySettings(s?.preferences)
}

async function writeSettings(ctx: StoreContext, customerPrivacy: CustomerPrivacySettings) {
  await ctx.tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify({ customerPrivacy })}::jsonb`,
    })
    .where(eq(store.id, ctx.storeId))
}

/**
 * Save the banner text and the data request window. The banner version is not
 * the merchant's to type: it only moves forward through `askConsentAgain`.
 */
export async function saveCustomerPrivacySettings(
  ctx: StoreContext,
  input: { bannerMessage: string; requestDueDays: number },
  actor: PrivacyActor,
): Promise<CustomerPrivacySettings> {
  const current = await loadCustomerPrivacySettings(ctx)
  const next = CustomerPrivacySettingsSchema.parse({
    ...current,
    bannerMessage: input.bannerMessage,
    requestDueDays: input.requestDueDays,
  })
  await writeSettings(ctx, next)
  await recordPrivacyEvent(ctx, {
    action: 'settings.saved',
    actor,
    detail: {
      requestDueDays: next.requestDueDays,
      bannerMessageChanged: next.bannerMessage !== current.bannerMessage,
    },
  })
  return next
}

/** Bump the banner version: every shopper sees the banner again and optional tags wait. */
export async function askConsentAgain(
  ctx: StoreContext,
  actor: PrivacyActor,
): Promise<CustomerPrivacySettings> {
  const current = await loadCustomerPrivacySettings(ctx)
  const next = { ...current, bannerVersion: current.bannerVersion + 1 }
  await writeSettings(ctx, next)
  await recordPrivacyEvent(ctx, {
    action: 'settings.saved',
    actor,
    detail: { bannerVersion: next.bannerVersion },
  })
  return next
}

export type CookieChoice = {
  analytics: boolean
  marketing: boolean
  bannerVersion: number
  visitorId?: string | null | undefined
  customerId?: string | null | undefined
  at?: Date | undefined
}

/** Keep the proof of one banner answer. The browser cookie is only a copy of this. */
export async function recordCookieConsent(ctx: StoreContext, choice: CookieChoice) {
  const [row] = await ctx.tx
    .insert(cookieConsent)
    .values({
      storeId: ctx.storeId,
      visitorId: choice.visitorId ?? null,
      customerId: choice.customerId ?? null,
      analytics: choice.analytics,
      marketing: choice.marketing,
      bannerVersion: choice.bannerVersion,
      ...(choice.at ? { createdAt: choice.at } : {}),
    })
    .returning({ id: cookieConsent.id, createdAt: cookieConsent.createdAt })
  return row
}

/** How shoppers answered the banner, for the Customer privacy page. */
export async function cookieConsentSummary(ctx: StoreContext, since: Date) {
  const [row] = await ctx.tx
    .select({
      total: sql<number>`count(*)::int`,
      analytics: sql<number>`count(*) filter (where ${cookieConsent.analytics})::int`,
      marketing: sql<number>`count(*) filter (where ${cookieConsent.marketing})::int`,
    })
    .from(cookieConsent)
    .where(
      sql`${cookieConsent.storeId} = ${ctx.storeId} and ${cookieConsent.createdAt} >= ${since.toISOString()}::timestamptz`,
    )
  return row ?? { total: 0, analytics: 0, marketing: 0 }
}
