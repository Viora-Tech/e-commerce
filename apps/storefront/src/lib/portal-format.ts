import { formatInZone } from '@commerce/dates'
import { formatMoney } from '@commerce/money'
import type { PayoutOutlook } from '@commerce/plugin-affiliates/server'
import { affiliateContent } from '@/data/affiliate'

/*
 * Money, dates and the payout outlook as the affiliate portal shows them. Pure: used by server
 * and client components alike.
 */

/** ₹1,234.50 from paise. */
export const money = (paise: number): string => formatMoney(paise)

/** "26 Nov 2026", India time. */
export const day = (d: Date | string): string => formatInZone(d, { dateStyle: 'medium' })

const outlook = affiliateContent.dashboard.outlook

/** The lines about their next payout: on its way, ready, what holds it, what clears next. */
export function outlookLines(o: PayoutOutlook): string[] {
  const lines: string[] = []
  if (o.processingPaise > 0) lines.push(outlook.processing(money(o.processingPaise)))
  if (o.readyPaise > 0 && !o.blocker) lines.push(outlook.ready(money(o.readyPaise)))
  if (o.blocker === 'below_minimum') lines.push(outlook.below(money(o.minPayoutPaise)))
  if (o.blocker === 'no_details') lines.push(outlook.noDetails)
  if (o.blocker === 'no_pan') lines.push(outlook.noPan)
  if (o.blocker === 'review') lines.push(outlook.review)
  if (o.nextClear) lines.push(outlook.nextClear(money(o.nextClear.paise), day(o.nextClear.at)))
  return lines.length ? lines : [outlook.nothing]
}

/** A store page as a referral link (`ref`, and `utm_source` when given), or null for another site. */
export function referralLink(
  origin: string,
  raw: string,
  code: string,
  source = '',
): string | null {
  const base = origin.replace(/\/+$/, '')
  try {
    const url = new URL(raw.trim() || '/', `${base}/`)
    if (url.origin !== new URL(base).origin) return null
    url.searchParams.set('ref', code)
    const s = source
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
    if (s) url.searchParams.set('utm_source', s)
    return url.toString()
  } catch {
    return null
  }
}
