/** SOURCE OF TRUTH: Pixels admin service — WHAT: add, edit, pause and remove a store's pixels, save or clear a Conversions API token (checked with Meta, stored with encryptSecret, only its last 4 shown), send a test event, and read the event log and 7-day stats / WHY: the router and MCP go through here, so no response ever carries a token */
import { dayKey } from '@commerce/dates'
import {
  type PixelConnectionStatus,
  type PixelEventName,
  type PixelPurchaseTrigger,
  pixelConnection,
  pixelEventDay,
  pixelEventLog,
  type StoreTx,
} from '@commerce/db'
import { and, count, desc, eq, gte, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { parseAppsSettings } from '../apps/settings'
import { storeAppsRow } from '../apps/store-apps'
import { CommerceError } from '../errors'
import { decryptSecret, encryptSecret } from '../secrets'
import { isMetaPixelId, MAX_PIXELS_PER_STORE, PIXEL_EVENTS, PURCHASE_TRIGGERS } from './client'
import { hashUserData } from './hash'
import { PIXELS_APP_ID } from './jobs'
import { bumpDay, upsertLogRow } from './log'
import { buildMetaEvent, type FetchLike, matchedOf, sendMetaEvents, verifyPixelToken } from './meta'

class PixelError extends CommerceError {}

const notFound = () => new PixelError('PIXEL_NOT_FOUND', 'That pixel no longer exists')

export type PixelDeps = { settingsSecret: string; fetch?: FetchLike | undefined }

// Inputs (the router validates with these).

const PixelIdSchema = z.string().trim().refine(isMetaPixelId, 'A Meta pixel ID is 10 to 20 digits')
const TokenSchema = z
  .string()
  .trim()
  .min(20, 'That does not look like a Conversions API token')
  .max(1000)
const TestCodeSchema = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9_-]*$/, 'Use the code exactly as Events Manager shows it')

const PixelSettingsSchema = z.object({
  name: z.string().trim().max(80).default(''),
  events: z
    .array(z.enum(PIXEL_EVENTS))
    .max(PIXEL_EVENTS.length)
    .default([...PIXEL_EVENTS]),
  purchaseTrigger: z.enum(PURCHASE_TRIGGERS).default('placed'),
  testEventCode: TestCodeSchema.default(''),
})

export const CreatePixelSchema = PixelSettingsSchema.extend({
  platform: z.literal('meta').default('meta'),
  pixelId: PixelIdSchema,
  token: TokenSchema.optional(),
})

export const UpdatePixelSchema = PixelSettingsSchema.partial().extend({ id: z.uuid() })
export const SetPixelTokenSchema = z.object({ id: z.uuid(), token: TokenSchema })

export const PixelLogFilterSchema = z.object({
  status: z.enum(['queued', 'sent', 'failed', 'skipped']).optional(),
  connectionId: z.uuid().optional(),
  eventName: z.enum(PIXEL_EVENTS).optional(),
  origin: z.enum(['storefront', 'order', 'test']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(10_000).default(0),
})

// Reads.

type Row = typeof pixelConnection.$inferSelect

/** What any client sees of a pixel: never the token, only whether there is one and its hint. */
function publicPixel(p: Row) {
  return {
    id: p.id,
    platform: p.platform,
    pixelId: p.pixelId,
    name: p.name,
    hasToken: Boolean(p.tokenEnc),
    tokenHint: p.tokenHint,
    testEventCode: p.testEventCode ?? '',
    events: p.events as PixelEventName[],
    purchaseTrigger: p.purchaseTrigger as PixelPurchaseTrigger,
    status: p.status as PixelConnectionStatus,
    lastError: p.lastError,
    lastErrorAt: p.lastErrorAt,
    lastSentAt: p.lastSentAt,
    createdAt: p.createdAt,
  }
}

export type PublicPixel = ReturnType<typeof publicPixel>

export async function pixelsInstalled(tx: StoreTx, storeId: string): Promise<boolean> {
  const s = await storeAppsRow(tx, storeId)
  return parseAppsSettings(s.apps).installed.includes(PIXELS_APP_ID)
}

export async function listPixels(tx: StoreTx): Promise<PublicPixel[]> {
  const rows = await tx.select().from(pixelConnection).orderBy(pixelConnection.createdAt)
  return rows.map(publicPixel)
}

async function row(tx: StoreTx, id: string): Promise<Row> {
  const [p] = await tx.select().from(pixelConnection).where(eq(pixelConnection.id, id))
  if (!p) throw notFound()
  return p
}

export async function getPixel(tx: StoreTx, id: string): Promise<PublicPixel> {
  return publicPixel(await row(tx, id))
}

// Writes.

const hint = (token: string) => token.slice(-4)

async function checkedToken(pixelId: string, token: string, deps: PixelDeps) {
  const r = await verifyPixelToken({ pixelId, token, fetch: deps.fetch })
  if (!r.ok) {
    throw new PixelError(
      'PIXEL_TOKEN_REFUSED',
      r.kind === 'retry'
        ? 'Meta did not answer. Try again in a minute.'
        : `Meta refused this token for pixel ${pixelId}: ${r.message}`,
    )
  }
  return r.name
}

export async function createPixel(
  tx: StoreTx,
  storeId: string,
  input: z.infer<typeof CreatePixelSchema>,
  deps: PixelDeps & { userId?: string | null | undefined },
): Promise<{ pixel: PublicPixel; metaName: string | null }> {
  const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(pixelConnection)
  if (n >= MAX_PIXELS_PER_STORE) {
    throw new PixelError('PIXEL_LIMIT', `A store can have up to ${MAX_PIXELS_PER_STORE} pixels`)
  }
  const [dupe] = await tx
    .select({ id: pixelConnection.id })
    .from(pixelConnection)
    .where(
      and(eq(pixelConnection.platform, input.platform), eq(pixelConnection.pixelId, input.pixelId)),
    )
  if (dupe) throw new PixelError('PIXEL_EXISTS', 'This pixel is already added')
  const metaName = input.token ? await checkedToken(input.pixelId, input.token, deps) : null
  const [p] = await tx
    .insert(pixelConnection)
    .values({
      storeId,
      platform: input.platform,
      pixelId: input.pixelId,
      name: input.name || metaName || '',
      tokenEnc: input.token ? encryptSecret(input.token, deps.settingsSecret) : null,
      tokenHint: input.token ? hint(input.token) : null,
      testEventCode: input.testEventCode || null,
      events: input.events,
      purchaseTrigger: input.purchaseTrigger,
      createdBy: deps.userId ?? null,
    })
    .returning()
  if (!p) throw new Error('pixel insert returned nothing')
  return { pixel: publicPixel(p), metaName }
}

export async function updatePixel(
  tx: StoreTx,
  input: z.infer<typeof UpdatePixelSchema>,
): Promise<PublicPixel> {
  await row(tx, input.id)
  const [p] = await tx
    .update(pixelConnection)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.events !== undefined ? { events: input.events } : {}),
      ...(input.purchaseTrigger !== undefined ? { purchaseTrigger: input.purchaseTrigger } : {}),
      ...(input.testEventCode !== undefined ? { testEventCode: input.testEventCode || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(pixelConnection.id, input.id))
    .returning()
  if (!p) throw notFound()
  return publicPixel(p)
}

/** Save a new token: Meta must accept it first. An errored pixel comes back to active. */
export async function setPixelToken(
  tx: StoreTx,
  input: z.infer<typeof SetPixelTokenSchema>,
  deps: PixelDeps,
): Promise<{ pixel: PublicPixel; metaName: string | null }> {
  const current = await row(tx, input.id)
  const metaName = await checkedToken(current.pixelId, input.token, deps)
  const [p] = await tx
    .update(pixelConnection)
    .set({
      tokenEnc: encryptSecret(input.token, deps.settingsSecret),
      tokenHint: hint(input.token),
      status: current.status === 'errored' ? 'active' : current.status,
      lastError: null,
      lastErrorAt: null,
      updatedAt: new Date(),
    })
    .where(eq(pixelConnection.id, input.id))
    .returning()
  if (!p) throw notFound()
  return { pixel: publicPixel(p), metaName }
}

/** Back to browser only. */
export async function clearPixelToken(tx: StoreTx, id: string): Promise<PublicPixel> {
  const current = await row(tx, id)
  const [p] = await tx
    .update(pixelConnection)
    .set({
      tokenEnc: null,
      tokenHint: null,
      status: current.status === 'errored' ? 'active' : current.status,
      lastError: null,
      lastErrorAt: null,
      updatedAt: new Date(),
    })
    .where(eq(pixelConnection.id, id))
    .returning()
  if (!p) throw notFound()
  return publicPixel(p)
}

export async function setPixelStatus(
  tx: StoreTx,
  id: string,
  status: 'active' | 'paused',
): Promise<PublicPixel> {
  const current = await row(tx, id)
  if (current.status === 'errored' && status === 'active') {
    throw new PixelError('PIXEL_TOKEN_NEEDED', 'Paste a new token to switch this pixel back on')
  }
  const [p] = await tx
    .update(pixelConnection)
    .set({ status, updatedAt: new Date() })
    .where(eq(pixelConnection.id, id))
    .returning()
  if (!p) throw notFound()
  return publicPixel(p)
}

export async function removePixel(tx: StoreTx, id: string): Promise<void> {
  await row(tx, id)
  await tx.delete(pixelConnection).where(eq(pixelConnection.id, id))
}

/**
 * Send one PageView with the pixel's test event code, now, so it shows in Events Manager →
 * Test events. Needs a token and a test code (without the code Meta would count it as real).
 */
export async function sendPixelTest(
  tx: StoreTx,
  storeId: string,
  id: string,
  deps: PixelDeps & { now?: Date | undefined },
): Promise<{ ok: true; fbtraceId: string | null } | { ok: false; message: string }> {
  const p = await row(tx, id)
  if (!p.tokenEnc) throw new PixelError('PIXEL_NO_TOKEN', 'Add a Conversions API token first')
  if (!p.testEventCode) {
    throw new PixelError('PIXEL_NO_TEST_CODE', 'Add the test event code from Events Manager first')
  }
  const now = deps.now ?? new Date()
  const eventId = crypto.randomUUID()
  const event = buildMetaEvent({ name: 'PageView', eventId, at: now, user: hashUserData({}) })
  const r = await sendMetaEvents({
    pixelId: p.pixelId,
    token: decryptSecret(p.tokenEnc, deps.settingsSecret),
    events: [event],
    testEventCode: p.testEventCode,
    fetch: deps.fetch,
    timeoutMs: 10_000,
  })
  const key = {
    storeId,
    connectionId: p.id,
    eventName: 'PageView' as const,
    eventId,
    origin: 'test' as const,
  }
  await upsertLogRow(tx, key, {
    status: r.ok ? 'sent' : 'failed',
    attempts: 1,
    matched: matchedOf(event),
    httpStatus: r.status || null,
    fbtraceId: r.fbtraceId,
    error: r.ok ? null : r.message,
    sentAt: r.ok ? now : null,
  })
  await bumpDay(tx, key, r.ok ? 'sent' : 'failed', now)
  return r.ok ? { ok: true, fbtraceId: r.fbtraceId } : { ok: false, message: r.message }
}

// Log and stats.

export async function listPixelLog(tx: StoreTx, filter: z.infer<typeof PixelLogFilterSchema>) {
  const where = and(
    filter.status ? eq(pixelEventLog.status, filter.status) : undefined,
    filter.connectionId ? eq(pixelEventLog.connectionId, filter.connectionId) : undefined,
    filter.eventName ? eq(pixelEventLog.eventName, filter.eventName) : undefined,
    filter.origin ? eq(pixelEventLog.origin, filter.origin) : undefined,
    filter.from ? gte(pixelEventLog.createdAt, filter.from) : undefined,
    filter.to ? lt(pixelEventLog.createdAt, filter.to) : undefined,
  )
  const [rows, [total]] = await Promise.all([
    tx
      .select()
      .from(pixelEventLog)
      .where(where)
      .orderBy(desc(pixelEventLog.createdAt))
      .limit(filter.limit)
      .offset(filter.offset),
    tx.select({ n: count() }).from(pixelEventLog).where(where),
  ])
  return { rows, total: total?.n ?? 0 }
}

export async function getPixelLog(tx: StoreTx, id: string) {
  const [r] = await tx.select().from(pixelEventLog).where(eq(pixelEventLog.id, id))
  if (!r) throw new PixelError('PIXEL_EVENT_NOT_FOUND', 'That event is no longer in the log')
  return r
}

/** The last `days` days: events sent, purchases sent, failures, and skips for no consent. */
export async function pixelStats(tx: StoreTx, now: Date = new Date(), days = 7) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const sinceDay = dayKey(since)
  const [totals] = await tx
    .select({
      sent: sql<number>`coalesce(sum(${pixelEventDay.sent}), 0)::int`,
      failed: sql<number>`coalesce(sum(${pixelEventDay.failed}), 0)::int`,
      purchases: sql<number>`coalesce(sum(${pixelEventDay.sent}) filter (where ${pixelEventDay.eventName} = 'Purchase' and ${pixelEventDay.origin} = 'order'), 0)::int`,
    })
    .from(pixelEventDay)
    .where(gte(pixelEventDay.day, sinceDay))
  const [noConsent] = await tx
    .select({ n: count() })
    .from(pixelEventLog)
    .where(and(eq(pixelEventLog.skipReason, 'no_consent'), gte(pixelEventLog.createdAt, since)))
  return {
    sent: totals?.sent ?? 0,
    purchases: totals?.purchases ?? 0,
    failed: totals?.failed ?? 0,
    skippedNoConsent: noConsent?.n ?? 0,
  }
}
