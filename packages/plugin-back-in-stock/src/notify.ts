import type { StoreTx } from '@commerce/db'
import type { NotificationChannel } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { hasQuotaRemaining, recordSent } from './quota'
import { backInStockSignup, type Channel } from './schema'
import type { PlatformQuota } from './settings'

/** Split a list into chunks of at most `size`, the throttle unit ("N per minute"). */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) return items.length ? [items.slice()] : []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export type SignupRow = typeof backInStockSignup.$inferSelect

/** Confirmed signups still waiting for this variant, oldest first (fairness). */
export async function pendingSignupsFor(tx: StoreTx, storeId: string, variantId: string) {
  return tx
    .select()
    .from(backInStockSignup)
    .where(
      and(
        eq(backInStockSignup.storeId, storeId),
        eq(backInStockSignup.variantId, variantId),
        eq(backInStockSignup.status, 'confirmed'),
      ),
    )
    .orderBy(backInStockSignup.createdAt)
}

const channelFor = (row: SignupRow): Channel | null =>
  row.email ? 'email' : row.phone ? 'whatsapp' : null

export type RestockDeps = {
  /** Runs `fn` in a short transaction scoped to the store; used for each write, never around a network send. */
  inStore<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T>
  /** The store's active channels (email/WhatsApp), resolved once per run. */
  channels: NotificationChannel[]
  quota: PlatformQuota
  unlimited: boolean
  batchSize: number
  /** Available stock right now; re-checked at every batch boundary so a run stops if stock runs out mid-send. */
  availableStock(variantId: string): Promise<number>
  buildMessage(
    row: SignupRow,
    channel: Channel,
  ): { data: Parameters<NotificationChannel['send']>[0]['data'] }
  log?: ((message: string) => void) | undefined
  /** Injectable for tests; real callers pass the platform clock and a real delay. */
  now?: (() => Date) | undefined
  sleep?: ((ms: number) => Promise<void>) | undefined
}

export type RestockOutcome = {
  sent: number
  skippedQuota: number
  failed: number
  stoppedForStock: boolean
}

/**
 * Send exactly one message per confirmed signup for a restocked variant, in
 * throttled batches, marking each signup notified as it sends. A signup with
 * a WhatsApp number sends over WhatsApp only when the store enabled it and
 * has a WhatsApp channel; a signup past its store's free quota (and not
 * unlimited) is left `confirmed` and picked up by the next run once quota is
 * available again — the whole point of "pause" over pay-as-you-go.
 */
export async function sendRestockAlerts(
  deps: RestockDeps,
  storeId: string,
  variantId: string,
): Promise<RestockOutcome> {
  const log = deps.log ?? (() => {})
  const now = deps.now ?? (() => new Date())
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const signups = await deps.inStore((tx) => pendingSignupsFor(tx, storeId, variantId))
  const batches = chunk(signups, Math.max(1, deps.batchSize))

  let sent = 0
  let skippedQuota = 0
  let failed = 0
  let stoppedForStock = false

  for (let b = 0; b < batches.length; b += 1) {
    const available = await deps.availableStock(variantId)
    if (available <= 0) {
      stoppedForStock = true
      log(`[back-in-stock] ${storeId}/${variantId}: stock ran out mid-send, stopping`)
      break
    }
    const batch = batches[b] ?? []
    for (const row of batch) {
      const channel = channelFor(row)
      if (!channel) continue
      const notifier = deps.channels.find(
        (c) => c.requires === (channel === 'email' ? 'email' : 'phone'),
      )
      if (!notifier) continue

      const ok = await deps.inStore((tx) =>
        hasQuotaRemaining(tx, storeId, channel, deps.quota, deps.unlimited, now()),
      )
      if (!ok) {
        skippedQuota += 1
        continue
      }

      const { data } = deps.buildMessage(row, channel)
      const to =
        channel === 'email' ? { email: row.email ?? undefined } : { phone: row.phone ?? undefined }
      const result = await notifier.send({ to, template: 'back_in_stock_alert', data })
      if (!result.ok) {
        failed += 1
        log(`[back-in-stock] send failed for signup ${row.id}: ${result.error}`)
        continue
      }
      await deps.inStore(async (tx) => {
        await recordSent(tx, storeId, channel, now())
        await tx
          .update(backInStockSignup)
          .set({ status: 'notified', notifiedAt: now(), updatedAt: now() })
          .where(eq(backInStockSignup.id, row.id))
      })
      sent += 1
    }
    // Throttle: one batch per tick, sleep before the next one so the store's
    // configured batch size is a rate ("N per minute"), not a hard cap.
    if (b < batches.length - 1) await sleep(60_000)
  }

  return { sent, skippedQuota, failed, stoppedForStock }
}
