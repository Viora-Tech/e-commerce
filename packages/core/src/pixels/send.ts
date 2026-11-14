/** SOURCE OF TRUTH: Pixels sender — WHAT: one `{pixels}-send` job: loads the pixel and the order or storefront facts, hashes the customer details, POSTs the event to Meta and records the outcome (log row, day counter, pixel status, app activity; an expired token turns the pixel to Error and writes one owner alert) / WHY: the only place a Conversions API token is decrypted for sending, so the no-raw-PII and once-only rules are enforced in one spot */
import {
  address,
  cart,
  cartLine,
  type Db,
  order,
  orderLine,
  type PixelEventName,
  pixelConnection,
  type StoreTx,
  variant,
  withStore,
} from '@commerce/db'
import { and, eq, ne } from 'drizzle-orm'
import { recordAppActivity, recordAppError } from '../apps/installation'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import { decryptSecret } from '../secrets'
import { hasMarketingConsent } from './client'
import { hashUserData } from './hash'
import {
  PIXELS_APP_ID,
  type PixelOrderSendJob,
  type PixelSendJob,
  type PixelStorefrontSendJob,
} from './jobs'
import { bumpDay, findLogRow, type LogKey, logSkip, upsertLogRow } from './log'
import {
  buildMetaEvent,
  type FetchLike,
  type MetaContent,
  type MetaEventInput,
  matchedOf,
  sendMetaEvents,
} from './meta'

/** A Meta error worth another try; BullMQ retries the job with backoff. */
export class PixelRetryError extends CommerceError {
  constructor(message: string) {
    super('PIXEL_SEND_RETRY', message)
  }
}

export type SendDeps = {
  settingsSecret: string
  fetch?: FetchLike | undefined
  now?: Date | undefined
}

export type SendAttempt = { attempt: number; maxAttempts: number }

export type SendOutcome = 'sent' | 'skipped' | 'failed' | 'errored' | 'gone'

type Prepared =
  | { kind: 'done'; outcome: SendOutcome }
  | {
      kind: 'send'
      key: LogKey
      pixelId: string
      token: string
      testEventCode: string | null
      event: MetaEventInput
      orderId: string | null
      valuePaise: number | null
      /** Successful storefront PageViews are counted, not logged row by row. */
      logSuccess: boolean
    }

async function orderEvent(
  tx: StoreTx,
  job: PixelOrderSendJob,
): Promise<{ event: MetaEventInput; valuePaise: number } | 'no_consent' | null> {
  const [o] = await tx.select().from(order).where(eq(order.id, job.orderId))
  if (!o) return null
  if (!hasMarketingConsent(o.tracking)) return 'no_consent'
  const [addr] = o.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const lines = await tx
    .select({
      variantId: orderLine.variantId,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
    })
    .from(orderLine)
    .where(eq(orderLine.orderId, o.id))
  const contents: MetaContent[] = lines
    .filter((l) => l.variantId)
    .map((l) => ({
      id: l.variantId as string,
      quantity: l.quantity,
      itemPricePaise: l.unitPricePaise,
    }))
  const t = o.tracking ?? {}
  return {
    valuePaise: o.totalPaise,
    event: {
      name: 'Purchase',
      eventId: job.eventId,
      at: o.placedAt,
      url: t.landingUrl,
      user: hashUserData({
        email: o.email,
        phone: o.phone ?? addr?.phone,
        name: addr?.name,
        city: addr?.city,
        state: addr?.stateCode,
        pincode: addr?.pincode,
        country: addr?.country,
        externalId: o.customerId,
      }),
      ip: t.ip,
      ua: t.ua,
      fbp: t.fbp,
      fbc: t.fbc,
      valuePaise: o.totalPaise,
      contents,
      orderNumber: o.number,
    },
  }
}

async function cartContents(
  tx: StoreTx,
  cartId: string,
  only?: { lineId?: string | undefined; variantId?: string | undefined },
) {
  const rows = await tx
    .select({
      id: cartLine.id,
      variantId: cartLine.variantId,
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
    })
    .from(cartLine)
    .where(eq(cartLine.cartId, cartId))
  return rows
    .filter(
      (r) =>
        (!only?.lineId || r.id === only.lineId) &&
        (!only?.variantId || r.variantId === only.variantId),
    )
    .map((r) => ({ id: r.variantId, quantity: r.quantity, itemPricePaise: r.unitPricePaise }))
}

async function storefrontEvent(
  tx: StoreTx,
  job: PixelStorefrontSendJob,
): Promise<{ event: MetaEventInput; valuePaise: number | null }> {
  let contents: MetaContent[] = []
  let email: string | null = null
  let phone: string | null = null
  let name: string | null = null
  let country: string | null = null
  let customerId: string | null = null
  if (
    job.cartId &&
    (job.eventName === 'AddToCart' ||
      job.eventName === 'InitiateCheckout' ||
      job.eventName === 'AddPaymentInfo')
  ) {
    // AddToCart is about the line just added (by line id, else by variant).
    const only =
      job.eventName === 'AddToCart'
        ? { lineId: job.cartLineId, variantId: job.cartLineId ? undefined : job.variantId }
        : undefined
    contents = await cartContents(tx, job.cartId, only)
    // The line holds every unit of the variant; the event is about the ones just added.
    const added = job.eventName === 'AddToCart' ? job.quantity : undefined
    if (added) contents = contents.map((c) => ({ ...c, quantity: Math.min(c.quantity, added) }))
    const [c] = await tx
      .select({
        email: cart.email,
        phone: cart.phone,
        name: cart.customerName,
        country: cart.countryCode,
        customerId: cart.customerId,
      })
      .from(cart)
      .where(eq(cart.id, job.cartId))
    email = c?.email ?? null
    phone = c?.phone ?? null
    name = c?.name ?? null
    country = c?.country ?? null
    customerId = c?.customerId ?? null
  } else if (job.eventName === 'ViewContent' && job.variantId) {
    const [v] = await tx
      .select({ id: variant.id, pricePaise: variant.pricePaise })
      .from(variant)
      .where(eq(variant.id, job.variantId))
    // A variant listed without a price (#913) reports no value rather than ₹0.
    if (v?.pricePaise != null) contents = [{ id: v.id, quantity: 1, itemPricePaise: v.pricePaise }]
  }
  const valuePaise =
    contents.length > 0 ? contents.reduce((n, c) => n + c.quantity * c.itemPricePaise, 0) : null
  return {
    valuePaise,
    event: {
      name: job.eventName,
      eventId: job.eventId,
      at: new Date(job.at),
      url: job.url,
      user: hashUserData({ email, phone, name, country, externalId: customerId ?? job.visitorId }),
      ip: job.ip,
      ua: job.ua,
      fbp: job.fbp,
      fbc: job.fbc,
      ...(valuePaise !== null ? { valuePaise, contents } : {}),
    },
  }
}

async function prepare(
  tx: StoreTx,
  job: PixelSendJob,
  deps: SendDeps,
  now: Date,
): Promise<Prepared> {
  const [p] = await tx
    .select()
    .from(pixelConnection)
    .where(eq(pixelConnection.id, job.connectionId))
  if (!p) return { kind: 'done', outcome: 'gone' }
  const key: LogKey = {
    storeId: job.storeId,
    connectionId: p.id,
    eventName: job.eventName,
    eventId: job.eventId,
    origin: job.origin,
  }
  const existing = await findLogRow(tx, key)
  if (existing?.status === 'sent') return { kind: 'done', outcome: 'sent' }
  const orderId = job.origin === 'order' ? job.orderId : null
  if (p.status !== 'active' || !p.tokenEnc || !p.events.includes(job.eventName)) {
    const reason = p.status === 'errored' ? 'errored' : 'paused'
    await logSkip(tx, key, reason, { orderId }, now)
    return { kind: 'done', outcome: 'skipped' }
  }
  const built = job.origin === 'order' ? await orderEvent(tx, job) : await storefrontEvent(tx, job)
  if (built === null) return { kind: 'done', outcome: 'gone' }
  if (built === 'no_consent') {
    await logSkip(tx, key, 'no_consent', { orderId }, now)
    return { kind: 'done', outcome: 'skipped' }
  }
  return {
    kind: 'send',
    key,
    pixelId: p.pixelId,
    token: decryptSecret(p.tokenEnc, deps.settingsSecret),
    testEventCode: p.testEventCode,
    event: built.event,
    orderId,
    valuePaise: built.valuePaise,
    logSuccess: !(job.origin === 'storefront' && job.eventName === 'PageView'),
  }
}

const ACTIVITY: Partial<Record<PixelEventName, string>> = {
  Purchase: 'Sent a purchase to Meta',
}

/**
 * Send one event. Returns what happened; throws `PixelRetryError` when Meta asked us to try
 * again and attempts remain (the last attempt is recorded as failed instead).
 */
export async function runPixelSendJob(
  db: Db,
  job: PixelSendJob,
  deps: SendDeps,
  attempt: SendAttempt = { attempt: 1, maxAttempts: 1 },
): Promise<SendOutcome> {
  const now = deps.now ?? new Date()
  const prepared = await withStore(db, job.storeId, (tx) => prepare(tx, job, deps, now))
  if (prepared.kind === 'done') return prepared.outcome

  const event = buildMetaEvent(prepared.event)
  const result = await sendMetaEvents({
    pixelId: prepared.pixelId,
    token: prepared.token,
    events: [event],
    testEventCode: prepared.testEventCode,
    fetch: deps.fetch,
  })
  const base = {
    attempts: attempt.attempt,
    matched: matchedOf(event),
    orderId: prepared.orderId,
    valuePaise: prepared.valuePaise,
  }
  const { key } = prepared

  if (result.ok) {
    await withStore(db, job.storeId, async (tx) => {
      if (prepared.logSuccess) {
        await upsertLogRow(tx, key, {
          ...base,
          status: 'sent',
          httpStatus: result.status,
          fbtraceId: result.fbtraceId,
          error: null,
          sentAt: now,
        })
      }
      await bumpDay(tx, key, 'sent', now)
      await tx
        .update(pixelConnection)
        .set({ lastSentAt: now, lastError: null, lastErrorAt: null })
        .where(eq(pixelConnection.id, key.connectionId))
      const summary = ACTIVITY[key.eventName]
      if (summary) await recordAppActivity(tx, job.storeId, PIXELS_APP_ID, summary, { now })
    })
    return 'sent'
  }

  const failure = {
    ...base,
    httpStatus: result.status || null,
    fbtraceId: result.fbtraceId,
    error: result.message,
  }
  if (result.kind === 'retry' && attempt.attempt < attempt.maxAttempts) {
    await withStore(db, job.storeId, (tx) =>
      upsertLogRow(tx, key, { ...failure, status: 'queued' }),
    )
    throw new PixelRetryError(result.message)
  }

  await withStore(db, job.storeId, async (tx) => {
    await upsertLogRow(tx, key, { ...failure, status: 'failed' })
    await bumpDay(tx, key, 'failed', now)
    if (result.kind !== 'auth') {
      await tx
        .update(pixelConnection)
        .set({ lastError: result.message, lastErrorAt: now })
        .where(eq(pixelConnection.id, key.connectionId))
      return
    }
    // The token stopped working: the pixel goes to Error and the owner hears once.
    const flipped = await tx
      .update(pixelConnection)
      .set({ status: 'errored', lastError: result.message, lastErrorAt: now, updatedAt: now })
      .where(and(eq(pixelConnection.id, key.connectionId), ne(pixelConnection.status, 'errored')))
      .returning({ pixelId: pixelConnection.pixelId })
    const first = flipped[0]
    if (!first) return
    await recordAppError(
      tx,
      job.storeId,
      PIXELS_APP_ID,
      'Meta stopped accepting a pixel token',
      now,
    )
    await insertOutboxEvent(tx, job.storeId, 'pixel.connection_failed', {
      platform: 'meta',
      externalId: first.pixelId,
      message: result.message,
    })
  })
  return result.kind === 'auth' ? 'errored' : 'failed'
}
