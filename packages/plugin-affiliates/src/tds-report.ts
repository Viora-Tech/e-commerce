/** SOURCE OF TRUTH: the quarterly TDS report — WHAT: one row per commission credited in a 26Q quarter, PAN decrypted / WHY: the merchant (or their CA) files 26Q from it; TDS filing itself stays outside the platform */
import { dayKey } from '@commerce/dates'
import { order, type StoreTx } from '@commerce/db'
import { and, asc, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm'
import { readPayoutDetails } from './affiliates'
import { csvCell, rupees } from './payouts'
import { affiliate, affiliateCommission } from './schema'
import type { StoreAffiliateSettings } from './settings'
import { quarterRange, type TdsQuarter } from './tds'

/** What 26Q takes for a deductee without a PAN. */
const PAN_NOT_AVAILABLE = 'PANNOTAVBL'

const HEAD = [
  'Deductee name',
  'PAN',
  'Section',
  'Credit date',
  'Amount credited (INR)',
  'TDS rate (%)',
  'TDS (INR)',
  'Order',
  'Affiliate code',
]

/** `2026-10-24` as `24-10-2026`, the way TDS software takes dates. */
const ddmmyyyy = (day: string) => day.split('-').reverse().join('-')

/**
 * Commissions credited (approved, TDS worked out) in the quarter, by IST credit date, as a CSV.
 * Each credit is one row: name, PAN (or PANNOTAVBL), the section from settings, credit date,
 * amount, rate and TDS. Commissions reversed after they were credited are listed again under
 * their own heading, so the CA can adjust. PANs are decrypted into the file only.
 */
export async function tdsReportCsv(
  tx: StoreTx,
  settings: StoreAffiliateSettings,
  quarter: TdsQuarter,
  secret: string,
): Promise<string> {
  const { from, to } = quarterRange(quarter)
  const rows = await tx
    .select({ c: affiliateCommission, a: affiliate, orderNumber: order.number })
    .from(affiliateCommission)
    .innerJoin(affiliate, eq(affiliate.id, affiliateCommission.affiliateId))
    .innerJoin(order, eq(order.id, affiliateCommission.orderId))
    .where(
      and(
        isNotNull(affiliateCommission.approvedAt),
        gte(affiliateCommission.approvedAt, from),
        lt(affiliateCommission.approvedAt, to),
        inArray(affiliateCommission.status, ['approved', 'paid', 'reversed']),
      ),
    )
    .orderBy(asc(affiliateCommission.approvedAt))
  const line = (r: (typeof rows)[number]) => {
    const pan = readPayoutDetails(r.a, secret)?.pan
    const bp = r.c.tdsPaise > 0 ? (pan ? settings.tds.bp : settings.tds.noPanBp) : 0
    return [
      r.a.name || r.a.code,
      pan ?? PAN_NOT_AVAILABLE,
      settings.tds.section,
      ddmmyyyy(dayKey(r.c.approvedAt as Date)),
      rupees(r.c.status === 'reversed' ? r.c.earnedPaise : r.c.commissionPaise),
      (bp / 100).toFixed(2),
      rupees(r.c.tdsPaise),
      `#${r.orderNumber}`,
      r.a.code,
    ]
      .map(csvCell)
      .join(',')
  }
  const credited = rows.filter((r) => r.c.status !== 'reversed')
  const reversed = rows.filter((r) => r.c.status === 'reversed')
  const out = [HEAD.map(csvCell).join(','), ...credited.map(line)]
  if (reversed.length > 0) {
    out.push(
      '',
      csvCell('Reversed after credit'),
      HEAD.map(csvCell).join(','),
      ...reversed.map(line),
    )
  }
  return `${out.join('\r\n')}\r\n`
}
