/** SOURCE OF TRUTH: Pixels event log writes — WHAT: one log row per pixel, event, event id and origin (a retry updates its own row) and the daily sent/failed/skipped counters per IST day / WHY: the admin's Event log and 7-day strip read these, and the log must never hold raw customer data */
import { dayKey } from '@commerce/dates'
import {
  type PixelEventName,
  type PixelEventOrigin,
  type PixelEventStatus,
  type PixelMatched,
  type PixelSkipReason,
  pixelEventDay,
  pixelEventLog,
  type StoreTx,
} from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import { cleanMetaMessage } from './meta'

export type LogKey = {
  storeId: string
  connectionId: string
  eventName: PixelEventName
  eventId: string
  origin: PixelEventOrigin
}

export type LogUpdate = {
  status: PixelEventStatus
  skipReason?: PixelSkipReason | null | undefined
  httpStatus?: number | null | undefined
  fbtraceId?: string | null | undefined
  error?: string | null | undefined
  attempts?: number | undefined
  matched?: PixelMatched | undefined
  valuePaise?: number | null | undefined
  orderId?: string | null | undefined
  sentAt?: Date | null | undefined
}

const keyWhere = (k: LogKey) =>
  and(
    eq(pixelEventLog.connectionId, k.connectionId),
    eq(pixelEventLog.eventName, k.eventName),
    eq(pixelEventLog.eventId, k.eventId),
    eq(pixelEventLog.origin, k.origin),
  )

/** The row for this event, if one was written. */
export async function findLogRow(tx: StoreTx, k: LogKey) {
  const [row] = await tx.select().from(pixelEventLog).where(keyWhere(k))
  return row ?? null
}

/** Write or update the row for this event. `error` is cut to 500 characters. */
export async function upsertLogRow(tx: StoreTx, k: LogKey, u: LogUpdate): Promise<void> {
  const values = {
    status: u.status,
    ...(u.skipReason !== undefined ? { skipReason: u.skipReason } : {}),
    ...(u.httpStatus !== undefined ? { httpStatus: u.httpStatus } : {}),
    ...(u.fbtraceId !== undefined ? { fbtraceId: u.fbtraceId } : {}),
    ...(u.error !== undefined ? { error: u.error ? cleanMetaMessage(u.error) : null } : {}),
    ...(u.attempts !== undefined ? { attempts: u.attempts } : {}),
    ...(u.matched !== undefined ? { matched: u.matched } : {}),
    ...(u.valuePaise !== undefined ? { valuePaise: u.valuePaise } : {}),
    ...(u.orderId !== undefined ? { orderId: u.orderId } : {}),
    ...(u.sentAt !== undefined ? { sentAt: u.sentAt } : {}),
  }
  await tx
    .insert(pixelEventLog)
    .values({ ...k, ...values })
    .onConflictDoUpdate({
      target: [
        pixelEventLog.connectionId,
        pixelEventLog.eventName,
        pixelEventLog.eventId,
        pixelEventLog.origin,
      ],
      set: values,
    })
}

/** Count one sent, failed or skipped event on its IST day. */
export async function bumpDay(
  tx: StoreTx,
  k: Omit<LogKey, 'eventId'>,
  outcome: 'sent' | 'failed' | 'skipped',
  at: Date,
): Promise<void> {
  const day = dayKey(at)
  const inc = { sent: 0, failed: 0, skipped: 0, [outcome]: 1 }
  await tx
    .insert(pixelEventDay)
    .values({
      storeId: k.storeId,
      connectionId: k.connectionId,
      day,
      eventName: k.eventName,
      origin: k.origin,
      ...inc,
    })
    .onConflictDoUpdate({
      target: [
        pixelEventDay.connectionId,
        pixelEventDay.day,
        pixelEventDay.eventName,
        pixelEventDay.origin,
      ],
      set: { [outcome]: sql`${pixelEventDay[outcome]} + 1` },
    })
}

/** A skipped event: logged with its reason and counted. */
export async function logSkip(
  tx: StoreTx,
  k: LogKey,
  reason: PixelSkipReason,
  extra: { orderId?: string | null; valuePaise?: number | null } = {},
  now: Date = new Date(),
): Promise<void> {
  const existing = await findLogRow(tx, k)
  if (existing?.status === 'skipped' && existing.skipReason === reason) return
  await upsertLogRow(tx, k, { status: 'skipped', skipReason: reason, ...extra })
  await bumpDay(tx, k, 'skipped', now)
}
