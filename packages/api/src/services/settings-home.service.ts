import {
  defaultPaymentSettings,
  isGatewayProvider,
  listDomains,
  listShippingZones,
  missingRequiredPolicies,
  type PolicyType,
  parseNotificationSettings,
  parsePaymentSettings,
  policyTypeOfHandle,
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

const filled = (v: string | null | undefined) => (v ?? '').trim().length > 0

/** The saved settings without the "skip for now" stamp, for comparing with the defaults. */
function withoutSkip(s: ReturnType<typeof parsePaymentSettings>) {
  const { setupSkippedAt: _skip, ...rest } = s
  return JSON.stringify(rest)
}

/**
 * Payments is done when a payment company is connected (switched on with its
 * account saved), or the merchant saved a payments choice themselves. Cash on
 * delivery being on by default does not count, and neither does "Skip for now".
 */
function paymentsChosen(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false
  const s = parsePaymentSettings(raw)
  const gateway = s.enabled.some(
    (id) => isGatewayProvider(id) && Object.values(s.providers[id] ?? {}).some(filled),
  )
  if (gateway) return true
  const offline = s.enabled.some((id) => id === 'cod' || id === 'manual')
  return offline && withoutSkip(s) !== withoutSkip(defaultPaymentSettings)
}

/**
 * What a new shop still has to set up, each item computed from real data:
 * store details, a way to get paid, somewhere to ship, GST, its own domain,
 * an email app for customer messages, and every required policy published
 * (Settings → Policies).
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
  const publishedPolicies = pages.flatMap((p): PolicyType[] => {
    const type = p.publishedAt ? policyTypeOfHandle(p.handle) : null
    return type ? [type] : []
  })
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
    { id: 'payments', done: paymentsChosen(s.payments) },
    { id: 'shipping', done: zones.some((z) => z.rates.length > 0) },
    { id: 'taxes', done: filled(general.gstin) },
    { id: 'domain', done: domains.some((d) => d.kind === 'custom' && d.status === 'active') },
    {
      id: 'notifications',
      done: parseNotificationSettings(s.notifications).enabled.includes('ses'),
    },
    {
      id: 'policies',
      done: missingRequiredPolicies(publishedPolicies).length === 0,
    },
  ]
}
