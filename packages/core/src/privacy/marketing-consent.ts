/** SOURCE OF TRUTH: marketing consent writes and history — WHAT: the one function that turns a customer's email, WhatsApp or SMS marketing consent on or off (flag on `customer` plus a `marketing_consent_event` row with source, actor and time) and the reader for a customer's consent and its history / WHY: campaigns and automations only message people with consent, so every change must land in the same place with proof of when and how it was given or withdrawn */
import { customer, marketingConsentEvent, type StoreTx } from '@commerce/db'
import { desc, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type PrivacyActor, recordPrivacyEvent } from './audit'
import { CONSENT_CHANNELS, CONSENT_FLAG, type ConsentChannel } from './client'

/** Where a consent change came from. Free text in the table; these are the ones we write. */
export type ConsentSource =
  | 'account'
  | 'newsletter'
  | 'checkout'
  | 'unsubscribe_link'
  | 'unsubscribe_page'
  | 'admin'
  | 'import'
  | 'erasure'

export type ConsentChange = {
  customerId: string
  channel: ConsentChannel
  granted: boolean
  source: ConsentSource
  actor: PrivacyActor
  at?: Date | undefined
}

const COLUMN = {
  acceptsMarketing: customer.acceptsMarketing,
  acceptsWhatsapp: customer.acceptsWhatsapp,
  acceptsSms: customer.acceptsSms,
} as const

/**
 * Turn one channel's consent on or off. Writes nothing when it already has
 * that value, so saving an unchanged form leaves no noise in the history.
 * A grant is a fresh opt in: it clears an earlier unsubscribe (which turned
 * every channel off). Staff changes also go to the privacy audit trail.
 * Returns whether anything changed.
 */
export async function setMarketingConsent(
  ctx: StoreContext,
  change: ConsentChange,
): Promise<boolean> {
  const at = change.at ?? new Date()
  const flag = CONSENT_FLAG[change.channel] as keyof typeof COLUMN
  const [row] = await ctx.tx
    .select({
      current: COLUMN[flag],
      anonymisedAt: customer.anonymisedAt,
      unsubscribedAt: customer.unsubscribedAt,
    })
    .from(customer)
    .where(eq(customer.id, change.customerId))
  if (!row || row.anonymisedAt) return false
  // Already so. (A yes over an old unsubscribe still counts as a fresh opt in.)
  if (row.current === change.granted && !(change.granted && row.unsubscribedAt)) return false
  await ctx.tx
    .update(customer)
    .set({
      [flag]: change.granted,
      ...(change.granted
        ? { marketingConsentAt: at, marketingConsentSource: change.source, unsubscribedAt: null }
        : {}),
      updatedAt: at,
    })
    .where(eq(customer.id, change.customerId))
  await ctx.tx.insert(marketingConsentEvent).values({
    storeId: ctx.storeId,
    customerId: change.customerId,
    channel: change.channel,
    granted: change.granted,
    source: change.source,
    actorType: change.actor.type,
    actorId: change.actor.id ?? null,
    createdAt: at,
  })
  if (change.actor.type === 'staff') {
    await recordPrivacyEvent(ctx, {
      action: 'consent.changed',
      actor: change.actor,
      customerId: change.customerId,
      detail: { channel: change.channel, granted: change.granted, source: change.source },
      at,
    })
  }
  return true
}

/** Set several channels at once (a profile form); returns the channels that changed. */
export async function setMarketingConsents(
  ctx: StoreContext,
  customerId: string,
  wanted: Partial<Record<ConsentChannel, boolean | undefined>>,
  meta: { source: ConsentSource; actor: PrivacyActor; at?: Date | undefined },
): Promise<ConsentChannel[]> {
  const changed: ConsentChannel[] = []
  for (const channel of CONSENT_CHANNELS) {
    const granted = wanted[channel]
    if (granted === undefined) continue
    if (await setMarketingConsent(ctx, { customerId, channel, granted, ...meta })) {
      changed.push(channel)
    }
  }
  return changed
}

/**
 * The unsubscribe link: every channel off, the time kept, so nothing reaches
 * the customer until they opt in again. Works from the storefront, where only
 * the customer id (from a signed token) is known, so the store comes from the row.
 */
export async function withdrawAllMarketing(
  tx: StoreTx,
  customerId: string,
  source: ConsentSource,
  at = new Date(),
): Promise<{ email: string | null } | null> {
  const [row] = await tx
    .select({
      storeId: customer.storeId,
      email: customer.email,
      acceptsMarketing: customer.acceptsMarketing,
      acceptsWhatsapp: customer.acceptsWhatsapp,
      acceptsSms: customer.acceptsSms,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!row) return null
  const ctx = { tx, storeId: row.storeId }
  for (const channel of CONSENT_CHANNELS) {
    await setMarketingConsent(ctx, {
      customerId,
      channel,
      granted: false,
      source,
      actor: { type: 'customer' },
      at,
    })
  }
  await tx
    .update(customer)
    .set({
      unsubscribedAt: sql`coalesce(${customer.unsubscribedAt}, ${at.toISOString()}::timestamptz)`,
      updatedAt: at,
    })
    .where(eq(customer.id, customerId))
  return { email: row.email }
}

export type ConsentHistoryEntry = {
  id: string
  channel: ConsentChannel
  granted: boolean
  source: string
  actorType: 'customer' | 'staff' | 'system'
  createdAt: Date
}

export type CustomerConsent = {
  channels: Record<ConsentChannel, boolean>
  unsubscribedAt: Date | null
  history: ConsentHistoryEntry[]
}

/** A customer's consent per channel now, and the latest changes (newest first). */
export async function customerMarketingConsent(
  ctx: StoreContext,
  customerId: string,
): Promise<CustomerConsent | null> {
  const [row] = await ctx.tx
    .select({
      acceptsMarketing: customer.acceptsMarketing,
      acceptsWhatsapp: customer.acceptsWhatsapp,
      acceptsSms: customer.acceptsSms,
      unsubscribedAt: customer.unsubscribedAt,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!row) return null
  const history = await ctx.tx
    .select({
      id: marketingConsentEvent.id,
      channel: marketingConsentEvent.channel,
      granted: marketingConsentEvent.granted,
      source: marketingConsentEvent.source,
      actorType: marketingConsentEvent.actorType,
      createdAt: marketingConsentEvent.createdAt,
    })
    .from(marketingConsentEvent)
    .where(eq(marketingConsentEvent.customerId, customerId))
    .orderBy(desc(marketingConsentEvent.createdAt), desc(marketingConsentEvent.id))
    .limit(100)
  return {
    channels: {
      email: row.acceptsMarketing,
      whatsapp: row.acceptsWhatsapp,
      sms: row.acceptsSms,
    },
    unsubscribedAt: row.unsubscribedAt,
    history,
  }
}
