/** SOURCE OF TRUTH: affiliate secrets at rest — WHAT: which affiliate columns hold encrypted blobs, and refreshing the phone blind index after a key rotation / WHY: `bun run rotate-secrets` must leave nothing under a retired key */
import {
  type CipherColumn,
  decryptCustomerPhone,
  decryptSecret,
  phoneBlindIndex,
} from '@commerce/core'
import { customer, type StoreTx } from '@commerce/db'
import { eq, isNotNull } from 'drizzle-orm'
import { PayoutDetailsSchema } from './affiliates'
import { fraudIndex, payoutKeys } from './blocklist'
import { phoneKey } from './fraud'
import { affiliate, affiliateBlocklist } from './schema'

/** `affiliate.payout_details` is one `encryptSecret` blob per row (UPI or bank, PAN). */
export const AFFILIATE_CIPHER_COLUMNS: CipherColumn[] = [
  { label: 'affiliate payout details', table: 'affiliate', column: 'payout_details' },
  { label: 'affiliate blocklist values', table: 'affiliate_blocklist', column: 'value' },
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
  return changed + (await refreshFraudIndexes(tx, secret, previousSecrets))
}

const open = (cipher: string, secret: string, previous: string[]): string | null => {
  try {
    return decryptSecret(cipher, secret, previous)
  } catch {
    return null
  }
}

/**
 * The fraud blind indexes after a rotation: each affiliate's PAN and payee (from their payout
 * details) and each blocklist value (from its encrypted copy). The signup IP is not kept, so its
 * index is cleared rather than left matching nothing.
 */
async function refreshFraudIndexes(
  tx: StoreTx,
  secret: string,
  previous: string[],
): Promise<number> {
  let changed = 0
  const affiliates = await tx
    .select({ id: affiliate.id, details: affiliate.payoutDetails })
    .from(affiliate)
  for (const a of affiliates) {
    const raw = a.details ? open(a.details, secret, previous) : null
    const parsed = raw ? PayoutDetailsSchema.safeParse(JSON.parse(raw)) : null
    const keys = parsed?.success ? payoutKeys(parsed.data) : { pan: null, payee: null }
    await tx
      .update(affiliate)
      .set({
        panIndex: keys.pan ? fraudIndex('pan', keys.pan, secret) : null,
        payeeIndex: keys.payee ? fraudIndex('payee', keys.payee, secret) : null,
        signupIpIndex: null,
      })
      .where(eq(affiliate.id, a.id))
    changed += 1
  }
  const entries = await tx.select().from(affiliateBlocklist)
  for (const e of entries) {
    const key = open(e.value, secret, previous)
    if (!key) continue
    await tx
      .update(affiliateBlocklist)
      .set({ valueIndex: fraudIndex(e.kind, key, secret) })
      .where(eq(affiliateBlocklist.id, e.id))
    changed += 1
  }
  return changed
}
