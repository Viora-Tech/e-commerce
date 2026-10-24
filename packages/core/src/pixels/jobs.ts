/** SOURCE OF TRUTH: Pixels queues — WHAT: the BullMQ queue names, job payloads, job ids and retry policy of the Pixels engine (order jobs per outbox row, send jobs per pixel and event, the daily prune) / WHY: the relay, the storefront collector, the API and the worker must agree on names and ids so a re-enqueue is always a no-op */
import type { PixelEventName } from '@commerce/db'

/** The app's plugin id (`store.apps.installed`, `app_installation`). */
export const PIXELS_APP_ID = 'pixels'

/** One job per outbox row Pixels reacts to (`px-order-<rowId>`): order placed, paid, delivered, a token that stopped working. */
export const PIXELS_ORDER_QUEUE = '{pixels}-order'
/** One job per pixel and event (`px-<connectionId>-<event>-<eventId>`): one Conversions API call. */
export const PIXELS_SEND_QUEUE = '{pixels}-send'
/** Daily: log and day rows older than 30 days go, and orders' tracking IP and UA are cleared. */
export const PIXELS_PRUNE_QUEUE = '{pixels}-prune'
export const PIXELS_PRUNE_EVERY_MS = 24 * 60 * 60 * 1000

export type PixelOrderJob = { storeId: string; outboxId: string }

/** A server Purchase: everything else is loaded from the order when it is sent. */
export type PixelOrderSendJob = {
  storeId: string
  connectionId: string
  origin: 'order'
  eventName: 'Purchase'
  eventId: string
  orderId: string
}

/**
 * A storefront event from `/api/px`. Ids, cookies, IP and user agent only: no email, phone or
 * address (those are read from Postgres at send time), and no values from the browser (prices
 * come from the catalogue or the cart).
 */
export type PixelStorefrontSendJob = {
  storeId: string
  connectionId: string
  origin: 'storefront'
  eventName: PixelEventName
  eventId: string
  /** ISO time the browser event happened (the collector's clock). */
  at: string
  url?: string | undefined
  fbp?: string | undefined
  fbc?: string | undefined
  ip?: string | undefined
  ua?: string | undefined
  visitorId?: string | undefined
  cartId?: string | undefined
  productId?: string | undefined
  variantId?: string | undefined
  cartLineId?: string | undefined
}

export type PixelSendJob = PixelOrderSendJob | PixelStorefrontSendJob

type AddOpts = {
  jobId?: string
  attempts?: number
  backoff?: { type: 'exponential' | 'fixed'; delay: number }
  removeOnComplete?: boolean | number
  removeOnFail?: boolean | number
}

export type PixelOrderQueue = {
  add(name: string, data: PixelOrderJob, opts?: AddOpts): Promise<unknown>
}
export type PixelSendQueue = {
  add(name: string, data: PixelSendJob, opts?: AddOpts): Promise<unknown>
}

/** Outbox types the relay hands to Pixels (only for stores with the app installed). */
export const PIXELS_OUTBOX_TYPES: ReadonlySet<string> = new Set([
  'order.placed',
  'order.paid',
  'order.delivered',
  'pixel.connection_failed',
])

/** BullMQ allows ':' in a custom id only as exactly three parts; dashes keep it simple. */
export const pixelOrderJobId = (outboxId: string): string => `px-order-${outboxId}`

const pixelSendJobId = (connectionId: string, name: PixelEventName, eventId: string) =>
  `px-${connectionId}-${name}-${eventId}`

/** Meta retries: 6 attempts, exponential from 30 s (about 16 minutes in all). */
export const PIXEL_SEND_ATTEMPTS = 6
const PIXEL_SEND_BACKOFF_MS = 30_000

export const sendJobOptions = (job: PixelSendJob): AddOpts => ({
  jobId: pixelSendJobId(job.connectionId, job.eventName, job.eventId),
  attempts: PIXEL_SEND_ATTEMPTS,
  backoff: { type: 'exponential', delay: PIXEL_SEND_BACKOFF_MS },
  removeOnComplete: true,
  removeOnFail: 1000,
})
