import {
  listDomains,
  listShippingZones,
  parseNotificationSettings,
  parsePaymentSettings,
  presentStoreGeneral,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { listPages } from './page.service'
import { getStore } from './store.service'

/** Checklist rows on the Settings home, in the order a new shop should do them. */
export type SetupItemId =
  | 'store'
  | 'payments'
  | 'shipping'
  | 'taxes'
  | 'domain'
  | 'notifications'
  | 'policies'

/** Page handles that read as a shop policy (returns, privacy, terms, shipping). */
const POLICY_HANDLE = /refund|return|privacy|terms|policy|policies|cancellation/i

const filled = (v: string | null | undefined) => (v ?? '').trim().length > 0

/**
 * What a new shop still has to set up, each item computed from real data:
 * store details, a way to get paid, somewhere to ship, GST, its own domain,
 * an email app for customer messages, and published policy pages.
 */
export async function settingsChecklist(
  tx: StoreTx,
  storeId: string,
): Promise<{ id: SetupItemId; done: boolean }[]> {
  const s = await getStore(tx, storeId)
  if (!s) return []
  const general = presentStoreGeneral(s)
  // One transaction: run the reads one after another.
  const zones = await listShippingZones(tx)
  const domains = await listDomains(tx)
  const pages = await listPages(tx)
  const a = general.address
  return [
    {
      id: 'store',
      done:
        filled(general.name) &&
        filled(general.contactEmail) &&
        filled(a.line1) &&
        filled(a.city) &&
        filled(a.pincode),
    },
    { id: 'payments', done: parsePaymentSettings(s.payments).enabled.length > 0 },
    { id: 'shipping', done: zones.some((z) => z.rates.length > 0) },
    { id: 'taxes', done: filled(general.gstin) },
    { id: 'domain', done: domains.some((d) => d.kind === 'custom' && d.status === 'active') },
    {
      id: 'notifications',
      done: parseNotificationSettings(s.notifications).enabled.includes('ses'),
    },
    {
      id: 'policies',
      done: pages.some((p) => p.publishedAt !== null && POLICY_HANDLE.test(p.handle)),
    },
  ]
}
