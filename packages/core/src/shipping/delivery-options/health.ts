/** SOURCE OF TRUTH: courier app health at checkout — WHAT: the circuit breaker (an app that failed
 * 3 times in 60 s is skipped for 5 min), each app's recent live calls (success, latency, last
 * error), and the share of checkouts that fell back to the zone rate, all in Redis per store /
 * WHY: a Shiprocket outage must cost nothing after the first few checkouts, and the merchant
 * must see on the app page which courier app is struggling before shoppers notice.
 * The store is passed in (the storefront and admin give Redis) so core stays free of a Redis
 * client; a store without the list and counter calls simply has no breaker and no health.
 */
import type { DeliveryResolveResult } from './resolve-types'

/** What the breaker and health need beyond a JSON get/set. */
export type HealthStore = {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
  /** Add one and return the new count; the key expires `ttlSeconds` after it was created. */
  incr?(key: string, ttlSeconds: number): Promise<number>
  /** Newest first, keeping the latest `keep` entries. */
  push?(key: string, value: unknown, keep: number, ttlSeconds: number): Promise<void>
  list?<T>(key: string): Promise<T[]>
}

export const BREAKER_FAILURES = 3
const BREAKER_WINDOW_SECONDS = 60
const BREAKER_OPEN_SECONDS = 5 * 60
/** Live calls kept per app for the health line. */
const HEALTH_KEEP = 50
const HEALTH_TTL_SECONDS = 24 * 3600
/** Hourly checkout counters, kept a little over a day. */
const COUNTER_TTL_SECONDS = 25 * 3600

const breakerKey = (storeId: string, providerId: string) =>
  `{shipping}:delivery-breaker:${storeId}:${providerId}`
const failuresKey = (storeId: string, providerId: string) =>
  `{shipping}:delivery-breaker-fails:${storeId}:${providerId}`
const callsKey = (storeId: string, providerId: string) =>
  `{shipping}:delivery-health:${storeId}:${providerId}`
const hourKey = (kind: 'quotes' | 'backup', storeId: string, hour: number) =>
  `{shipping}:delivery-${kind}:${storeId}:${hour}`

/** One live courier call at checkout. */
export type CourierCall = {
  at: number
  ok: boolean
  /** How long the call took, past checkout's deadline or not; null on older records. */
  ms: number | null
  error: string | null
}

/** Set while an app is skipped. */
export type BreakerState = { since: string; error: string | null }

/** Whether checkout skips this app right now. Never throws: a Redis hiccup means "closed". */
export async function breakerOpen(
  store: HealthStore,
  storeId: string,
  providerId: string,
): Promise<BreakerState | null> {
  return store.get<BreakerState>(breakerKey(storeId, providerId)).catch(() => null)
}

/**
 * Remember one live call when it ends: its outcome for the health line, and a failure (an error,
 * or the adapter's own timeout) towards the breaker. A late answer is a success (#1524). The third failure inside the window opens it.
 */
export async function recordCourierCall(
  store: HealthStore,
  storeId: string,
  providerId: string,
  call: CourierCall,
): Promise<void> {
  try {
    await store.push?.(callsKey(storeId, providerId), call, HEALTH_KEEP, HEALTH_TTL_SECONDS)
    if (call.ok || !store.incr) return
    const failures = await store.incr(failuresKey(storeId, providerId), BREAKER_WINDOW_SECONDS)
    if (failures === BREAKER_FAILURES) {
      const state: BreakerState = { since: new Date(call.at).toISOString(), error: call.error }
      await store.set(breakerKey(storeId, providerId), state, BREAKER_OPEN_SECONDS)
    }
  } catch {
    // Health is a nicety: it never fails a checkout.
  }
}

const hourOf = (ms: number) => Math.floor(ms / 3_600_000)

/** A checkout ran the engine afresh; count it, and whether it fell back to the zone rate. */
export async function recordCheckoutQuote(
  store: HealthStore,
  storeId: string,
  result: Pick<DeliveryResolveResult, 'status' | 'options'>,
  now: number = Date.now(),
): Promise<void> {
  if (!store.incr) return
  const hour = hourOf(now)
  try {
    await store.incr(hourKey('quotes', storeId, hour), COUNTER_TTL_SECONDS)
    if (onBackup(result)) await store.incr(hourKey('backup', storeId, hour), COUNTER_TTL_SECONDS)
  } catch {
    // As above.
  }
}

/** The shopper saw the zone rate instead of courier prices (couriers down or slow). */
export const onBackup = (result: Pick<DeliveryResolveResult, 'status' | 'options'>): boolean =>
  result.status === 'none' || result.options.some((o) => o.source === 'backup')

export type AppHealth = {
  providerId: string
  /** Live calls remembered (the last 50 within a day). */
  calls: number
  /** 0–1, null with no calls. */
  successRate: number | null
  /** Median of the calls that answered, ms. */
  typicalMs: number | null
  /** Calls among them that failed (an error or the adapter's own timeout). */
  failures: number
  lastError: { at: string; message: string } | null
  /** Skipped by the breaker since then; null when checkout asks it. */
  skippedSince: string | null
}

export type DeliveryHealth = {
  apps: AppHealth[]
  /** Checkouts that ran the engine in the last 24 h, and how many fell back to the zone rate. */
  checkouts24h: number
  backup24h: number
  /** Median answer time over every app's answered calls, ms; null with none. */
  typicalMs: number | null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[mid] as number)
    : Math.round(((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2)
}

/** The app page's health line for each connected app, plus the backup share. */
export async function deliveryHealth(
  store: HealthStore,
  storeId: string,
  providerIds: readonly string[],
  now: number = Date.now(),
): Promise<DeliveryHealth> {
  const answered: number[] = []
  const apps = await Promise.all(
    providerIds.map(async (providerId): Promise<AppHealth> => {
      const [calls, open] = await Promise.all([
        store.list ? store.list<CourierCall>(callsKey(storeId, providerId)).catch(() => []) : [],
        breakerOpen(store, storeId, providerId),
      ])
      const failed = calls.find((c) => !c.ok)
      const ms = calls.flatMap((c) => (c.ok && c.ms !== null ? [c.ms] : []))
      answered.push(...ms)
      return {
        providerId,
        calls: calls.length,
        successRate: calls.length ? calls.filter((c) => c.ok).length / calls.length : null,
        typicalMs: median(ms),
        failures: calls.filter((c) => !c.ok).length,
        lastError: failed
          ? { at: new Date(failed.at).toISOString(), message: failed.error ?? '' }
          : null,
        skippedSince: open?.since ?? null,
      }
    }),
  )
  const hours = Array.from({ length: 24 }, (_, i) => hourOf(now) - i)
  const count = async (kind: 'quotes' | 'backup') =>
    (
      await Promise.all(
        hours.map((h) => store.get<number>(hourKey(kind, storeId, h)).catch(() => null)),
      )
    ).reduce<number>((sum, n) => sum + (Number(n) || 0), 0)
  const [checkouts24h, backup24h] = await Promise.all([count('quotes'), count('backup')])
  return { apps, checkouts24h, backup24h, typicalMs: median(answered) }
}
