/** SOURCE OF TRUTH: payment credential refresh — WHAT renews a gateway's short-lived tokens (OAuth) / WHY before checkout, reconciliation or the admin use them, without a cron over every store */
import { store } from '@commerce/db'
import type { PaymentRegistry } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { decryptPaymentSettings, encryptPaymentSettings, parsePaymentSettings } from './settings'

export type CredentialRefresh = { providerId: string; ok: boolean; error?: string | undefined }

/**
 * Give every configured gateway with a `refreshCredentials` hook the chance to
 * renew its tokens, and save what changed (encrypted). Called where providers
 * are about to be used (checkout, the unpaid-order tick, the admin's Payments
 * page), so an active store never runs on an expired token. Hooks answer null
 * without a network call when nothing is due, so the common case costs one
 * read and no lock.
 *
 * A failed refresh is reported, never thrown: the old token may still work,
 * and the admin's health line tells the merchant to reconnect when it doesn't.
 */
export async function refreshPaymentCredentials(
  ctx: StoreContext,
  registry: PaymentRegistry,
  secret: string,
  previousSecrets: string[] = [],
  now: Date = new Date(),
): Promise<CredentialRefresh[]> {
  const hooks = registry.ids().filter((id) => registry.get(id)?.refreshCredentials)
  if (hooks.length === 0) return []
  const [row] = await ctx.tx
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  if (!row) return []
  const settings = parsePaymentSettings(row.payments)
  const decrypted = decryptPaymentSettings(settings, secret, previousSecrets)
  const results: CredentialRefresh[] = []
  let providers = decrypted.providers
  for (const id of hooks) {
    const saved = providers[id]
    const hook = registry.get(id)?.refreshCredentials
    if (!saved || !hook) continue
    try {
      const patch = await hook(saved, now)
      if (!patch) continue
      providers = { ...providers, [id]: { ...saved, ...patch } }
      results.push({ providerId: id, ok: true })
    } catch (err) {
      results.push({
        providerId: id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  if (results.some((r) => r.ok)) {
    const next = encryptPaymentSettings({ ...settings, providers }, secret, registry)
    await ctx.tx.update(store).set({ payments: next }).where(eq(store.id, ctx.storeId))
  }
  return results
}
