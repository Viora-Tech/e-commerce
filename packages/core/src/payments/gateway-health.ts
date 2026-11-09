/** SOURCE OF TRUTH: payment gateway health — WHAT: a gateway that refused the store's API keys is marked unhealthy (`payment_gateway_health`), hidden at checkout for a cool-down, re-tested with its read-only key check before it shows again, and the owner is told once per incident / WHY: Razorpay rejected Waimers' keys from 7 Nov 2026; every checkout failed instantly, shoppers were told their payment did not go through, and each retry made another unpaid order */
import { type Db, paymentGatewayHealth, type StoreTx, withStore } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { insertOutboxEvent } from '../outbox/write'

/** How long checkout hides a gateway that refused the keys before it checks them again. */
const GATEWAY_RETEST_MS = 10 * 60_000

/** Methods that run on another gateway's keys (Razorpay UPI QR) share that gateway's health. */
const credentialGateway = (providerId: string): string =>
  providerId.startsWith('razorpay') ? 'razorpay' : providerId

/** The gateway's own name, for the owner's email and the admin banner. */
export function gatewayName(gateway: string): string {
  const id = credentialGateway(gateway)
  return id.charAt(0).toUpperCase() + id.slice(1)
}

export type UnhealthyGateway = {
  gateway: string
  since: Date
  lastError: string | null
  lastFailedAt: Date | null
  retestAfter: Date | null
}

/**
 * The gateway refused the store's keys: mark it unhealthy (the incident keeps its first time),
 * push the next key check back by the cool-down, and, once per incident, write the owner's alert
 * (`payments.gateway_keys_refused`) in the same transaction. Returns true for a new alert.
 */
export async function noteGatewayKeysRefused(
  db: Db,
  storeId: string,
  providerId: string,
  gatewayWords: string,
  now: Date = new Date(),
): Promise<boolean> {
  const gateway = credentialGateway(providerId)
  const retestAfter = new Date(now.getTime() + GATEWAY_RETEST_MS)
  return withStore(db, storeId, async (tx) => {
    await tx
      .insert(paymentGatewayHealth)
      .values({
        storeId,
        gateway,
        unhealthySince: now,
        lastError: gatewayWords.slice(0, 500),
        lastFailedAt: now,
        retestAfter,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [paymentGatewayHealth.storeId, paymentGatewayHealth.gateway],
        set: {
          unhealthySince: sql`coalesce(${paymentGatewayHealth.unhealthySince}, ${now.toISOString()}::timestamptz)`,
          lastError: gatewayWords.slice(0, 500),
          lastFailedAt: now,
          retestAfter,
          updatedAt: now,
        },
      })
    // Claimed with `where`, so two checkouts failing together write one alert.
    const claimed = await tx
      .update(paymentGatewayHealth)
      .set({ alertedAt: now })
      .where(
        and(
          eq(paymentGatewayHealth.storeId, storeId),
          eq(paymentGatewayHealth.gateway, gateway),
          isNotNull(paymentGatewayHealth.unhealthySince),
          or(
            isNull(paymentGatewayHealth.alertedAt),
            sql`${paymentGatewayHealth.alertedAt} < ${paymentGatewayHealth.unhealthySince}`,
          ),
        ),
      )
      .returning({ gateway: paymentGatewayHealth.gateway })
    if (claimed.length === 0) return false
    await insertOutboxEvent(tx, storeId, 'payments.gateway_keys_refused', {
      gatewayAlert: { gateway, error: gatewayWords.slice(0, 500) },
    })
    return true
  })
}

/** The keys passed a check (a re-test, a save, "Test connection"): the incident is over. */
export async function markGatewayHealthy(
  tx: StoreTx,
  storeId: string,
  providerId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await tx
    .update(paymentGatewayHealth)
    .set({ unhealthySince: null, retestAfter: null, lastOkAt: now, updatedAt: now })
    .where(
      and(
        eq(paymentGatewayHealth.storeId, storeId),
        eq(paymentGatewayHealth.gateway, credentialGateway(providerId)),
      ),
    )
    .returning({ gateway: paymentGatewayHealth.gateway })
  return rows.length > 0
}

/** The store's gateways that refused its keys and have not passed a check since. */
export async function unhealthyGateways(tx: StoreTx, storeId: string): Promise<UnhealthyGateway[]> {
  const rows = await tx
    .select({
      gateway: paymentGatewayHealth.gateway,
      since: paymentGatewayHealth.unhealthySince,
      lastError: paymentGatewayHealth.lastError,
      lastFailedAt: paymentGatewayHealth.lastFailedAt,
      retestAfter: paymentGatewayHealth.retestAfter,
    })
    .from(paymentGatewayHealth)
    .where(
      and(
        eq(paymentGatewayHealth.storeId, storeId),
        isNotNull(paymentGatewayHealth.unhealthySince),
      ),
    )
  return rows.flatMap((r) => (r.since ? [{ ...r, since: r.since }] : []))
}

/**
 * The gateway ids checkout hides now. An unhealthy gateway past its cool-down is checked again
 * with its read-only `testConnection()` (claimed first, so one request checks while the others
 * keep it hidden): passing shows it again, failing hides it for another cool-down.
 */
export async function hiddenGateways(
  tx: StoreTx,
  storeId: string,
  providers: readonly Pick<PaymentProvider, 'id' | 'testConnection'>[],
  now: Date = new Date(),
): Promise<Set<string>> {
  const unhealthy = await unhealthyGateways(tx, storeId)
  if (unhealthy.length === 0) return new Set()
  const hidden = new Set<string>()
  for (const u of unhealthy) {
    const tester =
      providers.find((p) => p.id === u.gateway && p.testConnection) ??
      providers.find((p) => credentialGateway(p.id) === u.gateway && p.testConnection)
    const due = !u.retestAfter || u.retestAfter.getTime() <= now.getTime()
    if (tester?.testConnection && due && (await claimRetest(tx, storeId, u.gateway, now))) {
      const check = await tester.testConnection().catch(() => ({ ok: false, message: '' }))
      if (check.ok) {
        await markGatewayHealthy(tx, storeId, u.gateway, now)
        continue
      }
    }
    hidden.add(u.gateway)
  }
  return hidden
}

/** True when this request may run the key check (it pushes the next one back first). */
async function claimRetest(tx: StoreTx, storeId: string, gateway: string, now: Date) {
  const rows = await tx
    .update(paymentGatewayHealth)
    .set({ retestAfter: new Date(now.getTime() + GATEWAY_RETEST_MS), updatedAt: now })
    .where(
      and(
        eq(paymentGatewayHealth.storeId, storeId),
        eq(paymentGatewayHealth.gateway, gateway),
        isNotNull(paymentGatewayHealth.unhealthySince),
        or(isNull(paymentGatewayHealth.retestAfter), lte(paymentGatewayHealth.retestAfter, now)),
      ),
    )
    .returning({ gateway: paymentGatewayHealth.gateway })
  return rows.length > 0
}

/** True when this provider id is hidden by `hidden` (its own keys, or the keys it runs on). */
export const isGatewayHidden = (hidden: ReadonlySet<string>, providerId: string): boolean =>
  hidden.has(credentialGateway(providerId))
