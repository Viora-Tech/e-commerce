/** SOURCE OF TRUTH: affiliate emails — WHAT: who an affiliate_update goes to and what it says / WHY: the worker sends it without knowing the app's tables */
import type { StoreTx } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { affiliate, affiliateCommission, affiliatePayout } from './schema'

export type AffiliateNotice = 'approved' | 'sale' | 'payout'

/** The storefront path of the affiliate portal. */
export const AFFILIATE_PORTAL_PATH = '/affiliate'

/**
 * The address and data for one `affiliate_update` email, or null when there is nothing to
 * send (the affiliate has no email, or the commission or payout is gone).
 */
export async function affiliateEmail(
  tx: StoreTx,
  input: {
    affiliateId: string
    notice: AffiliateNotice
    commissionId?: string | undefined
    payoutId?: string | undefined
    storefrontUrl: string
  },
): Promise<{ to: string; data: Partial<TemplateData> } | null> {
  const [a] = await tx.select().from(affiliate).where(eq(affiliate.id, input.affiliateId))
  if (!a?.email) return null
  const base = input.storefrontUrl.replace(/\/+$/, '')
  const info: NonNullable<TemplateData['affiliate']> = {
    kind: input.notice,
    name: a.name.split(' ')[0] || '',
    portalUrl: base ? `${base}${AFFILIATE_PORTAL_PATH}` : undefined,
  }
  if (input.notice === 'approved') {
    info.link = base ? `${base}/?ref=${a.code}` : undefined
    info.couponCode = a.couponCode ?? undefined
  } else if (input.notice === 'sale') {
    if (!input.commissionId) return null
    const [c] = await tx
      .select({ amount: affiliateCommission.commissionPaise, status: affiliateCommission.status })
      .from(affiliateCommission)
      .where(eq(affiliateCommission.id, input.commissionId))
    if (!c || c.status === 'reversed') return null
    info.amountLabel = formatMoney(c.amount)
  } else {
    if (!input.payoutId) return null
    const [p] = await tx
      .select()
      .from(affiliatePayout)
      .where(eq(affiliatePayout.id, input.payoutId))
    if (!p) return null
    info.amountLabel = formatMoney(p.netPaise)
    info.tdsLabel = p.tdsPaise > 0 ? formatMoney(p.tdsPaise) : undefined
    info.reference = p.reference || undefined
  }
  return { to: a.email, data: { customerName: info.name, affiliate: info } }
}
