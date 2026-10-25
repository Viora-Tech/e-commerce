/** SOURCE OF TRUTH: affiliate emails — WHAT: who an affiliate_update goes to and what it says / WHY: the worker sends it without knowing the app's tables */
import { decryptCustomerPhone } from '@commerce/core'
import { customer, type StoreTx } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { affiliate, affiliateCommission, affiliatePayout } from './schema'

export type AffiliateNotice = 'approved' | 'sale' | 'payout' | 'rejected'

/** The storefront path of the affiliate portal. */
export const AFFILIATE_PORTAL_PATH = '/affiliate'

/**
 * Who one `affiliate_update` goes to (their email, and the phone on their store account for
 * WhatsApp) and what it says, or null when there is nothing to send (no way to reach them, or
 * the commission or payout is gone).
 */
export async function affiliateEmail(
  tx: StoreTx,
  input: {
    affiliateId: string
    notice: AffiliateNotice
    commissionId?: string | undefined
    payoutId?: string | undefined
    storefrontUrl: string
    settingsSecret: string
  },
): Promise<{
  to: { email: string | null; phone: string | null }
  data: Partial<TemplateData>
} | null> {
  const [a] = await tx.select().from(affiliate).where(eq(affiliate.id, input.affiliateId))
  if (!a) return null
  const [c] = a.customerId
    ? await tx.select({ phone: customer.phone }).from(customer).where(eq(customer.id, a.customerId))
    : []
  const phone = decryptCustomerPhone(c?.phone, input.settingsSecret)
  if (!a.email && !phone) return null
  const base = input.storefrontUrl.replace(/\/+$/, '')
  const info: NonNullable<TemplateData['affiliate']> = {
    kind: input.notice,
    name: a.name.split(' ')[0] || '',
    portalUrl: base ? `${base}${AFFILIATE_PORTAL_PATH}` : undefined,
  }
  if (input.notice === 'approved') {
    info.link = base ? `${base}/?ref=${a.code}` : undefined
    info.couponCode = a.couponCode ?? undefined
  } else if (input.notice === 'rejected') {
    if (a.status !== 'rejected') return null
    info.reason = a.rejectReason ?? undefined
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
  return { to: { email: a.email, phone }, data: { customerName: info.name, affiliate: info } }
}

/**
 * The merchant's "new affiliate application" email: who applied, where they post, which program,
 * their answers, and the admin page to approve them. Null when the application is gone or was
 * decided already.
 */
export async function applicationNotice(
  tx: StoreTx,
  affiliateId: string,
  adminUrl: string,
): Promise<NonNullable<TemplateData['affiliate']> | null> {
  const [a] = await tx.select().from(affiliate).where(eq(affiliate.id, affiliateId))
  if (a?.status !== 'pending') return null
  const answers = Object.values(a.answers ?? {}).filter(Boolean)
  return {
    kind: 'applied',
    name: a.name,
    email: a.email ?? undefined,
    social: a.social || undefined,
    message: [a.message, ...answers].filter(Boolean).join('\n').slice(0, 2000) || undefined,
    adminUrl: adminUrl
      ? `${adminUrl.replace(/\/+$/, '')}/apps/affiliates/affiliates/${a.id}`
      : undefined,
  }
}
