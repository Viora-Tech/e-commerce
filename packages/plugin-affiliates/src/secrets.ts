/** SOURCE OF TRUTH: affiliate secrets at rest — WHAT: which affiliate columns hold encrypted blobs, and refreshing the phone blind index after a key rotation / WHY: `bun run rotate-secrets` must leave nothing under a retired key */
import { type CipherColumn, decryptCustomerPhone, phoneBlindIndex } from '@commerce/core'
import { customer, type StoreTx } from '@commerce/db'
import { eq, isNotNull } from 'drizzle-orm'
import { phoneKey } from './fraud'
import { affiliate } from './schema'

/** `affiliate.payout_details` is one `encryptSecret` blob per row (UPI or bank, PAN). */
export const AFFILIATE_CIPHER_COLUMNS: CipherColumn[] = [
  { label: 'affiliate payout details', table: 'affiliate', column: 'payout_details' },
]

/**
 * `affiliate.phone_index` is an HMAC under the settings key, so a rotation leaves it stale and
 * the self-referral phone check would stop matching. Recomputes it from the phone on the
 * affiliate's store account (run after the customers' phones moved to the new key, in the same
 * transaction). Affiliates the merchant added by hand have no phone and keep none.
 */
export async function refreshAffiliatePhoneIndexes(
  tx: StoreTx,
  secret: string,
  previousSecrets: string[] = [],
): Promise<number> {
  const rows = await tx
    .select({ id: affiliate.id, index: affiliate.phoneIndex, phone: customer.phone })
    .from(affiliate)
    .innerJoin(customer, eq(customer.id, affiliate.customerId))
    .where(isNotNull(affiliate.customerId))
  let changed = 0
  for (const r of rows) {
    const key = phoneKey(decryptCustomerPhone(r.phone, secret, previousSecrets))
    const next = key ? phoneBlindIndex(key, secret) : null
    if (next === r.index) continue
    await tx.update(affiliate).set({ phoneIndex: next }).where(eq(affiliate.id, r.id))
    changed += 1
  }
  return changed
}
