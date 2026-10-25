/** SOURCE OF TRUTH: affiliate payouts — WHAT: grouping approved commissions, marking them paid, the bank bulk-upload CSV / WHY: no money moves in the platform; the merchant pays outside and records it here */
import { insertOutboxEvent } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { readPayoutDetails } from './affiliates'
import { payoutGstPaise, payoutNetPaise } from './gst'
import { affiliate, affiliateCommission, affiliatePayout } from './schema'
import type { StoreAffiliateSettings } from './settings'
import { AffiliateError } from './store-settings'
import { financialYearStart } from './tds'

export type PayoutRow = typeof affiliatePayout.$inferSelect

export type PayoutCandidate = {
  affiliateId: string
  name: string
  code: string
  payoutHint: string | null
  grossPaise: number
  tdsPaise: number
  /** Earlier paid commissions whose orders came back, taken off this payout. */
  clawbackPaise: number
  /** GST added for a GST-registered affiliate. */
  gstPaise: number
  gstRegistered: boolean
  netPaise: number
  commissions: number
  /** Over the minimum payout and has payout details saved. */
  ready: boolean
  /**
   * Why not, when not ready. `no_pan`: the store asks for a PAN once an affiliate's commission
   * this financial year passes the TDS threshold, and they have none.
   */
  blocker: 'below_minimum' | 'no_details' | 'no_pan' | null
}

/** Commission credited (approved or paid) this financial year, per affiliate. */
async function creditedThisYear(tx: StoreTx, now: Date): Promise<Map<string, number>> {
  const rows = await tx
    .select({
      affiliateId: affiliateCommission.affiliateId,
      total: sql<number>`coalesce(sum(${affiliateCommission.commissionPaise}), 0)::int`,
    })
    .from(affiliateCommission)
    .where(
      and(
        inArray(affiliateCommission.status, ['approved', 'paid']),
        gte(affiliateCommission.approvedAt, financialYearStart(now)),
      ),
    )
    .groupBy(affiliateCommission.affiliateId)
  return new Map(rows.map((r) => [r.affiliateId, r.total]))
}

/** Clawbacks not yet recovered, per affiliate. */
async function openClawbacks(tx: StoreTx): Promise<Map<string, number>> {
  const rows = await tx
    .select({
      affiliateId: affiliateCommission.affiliateId,
      total: sql<number>`sum(${affiliateCommission.clawbackPaise})::int`,
    })
    .from(affiliateCommission)
    .where(
      and(
        sql`${affiliateCommission.clawbackPaise} > 0`,
        isNull(affiliateCommission.clawbackPayoutId),
      ),
    )
    .groupBy(affiliateCommission.affiliateId)
  return new Map(rows.map((r) => [r.affiliateId, r.total]))
}

/** Approved commissions not yet in a payout, per affiliate, less any clawback still owed. */
export async function payoutCandidates(
  tx: StoreTx,
  settings: StoreAffiliateSettings,
  now = new Date(),
): Promise<PayoutCandidate[]> {
  const clawbacks = await openClawbacks(tx)
  const credited = settings.requirePanAboveThreshold
    ? await creditedThisYear(tx, now)
    : new Map<string, number>()
  const rows = await tx
    .select({
      affiliateId: affiliateCommission.affiliateId,
      name: affiliate.name,
      code: affiliate.code,
      payoutHint: affiliate.payoutHint,
      hasPan: affiliate.hasPan,
      gstRegistered: affiliate.gstRegistered,
      gross: sql<number>`sum(${affiliateCommission.commissionPaise})::int`,
      tds: sql<number>`sum(${affiliateCommission.tdsPaise})::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(affiliateCommission)
    .innerJoin(affiliate, eq(affiliate.id, affiliateCommission.affiliateId))
    .where(and(eq(affiliateCommission.status, 'approved'), isNull(affiliateCommission.payoutId)))
    .groupBy(
      affiliateCommission.affiliateId,
      affiliate.name,
      affiliate.code,
      affiliate.payoutHint,
      affiliate.hasPan,
      affiliate.gstRegistered,
    )
  return rows.map((r) => {
    const clawbackPaise = Math.min(clawbacks.get(r.affiliateId) ?? 0, r.gross)
    const owed = r.gross - clawbackPaise
    const gstPaise = payoutGstPaise(settings.gst, r.gstRegistered, owed)
    const panNeeded =
      settings.requirePanAboveThreshold &&
      !r.hasPan &&
      (credited.get(r.affiliateId) ?? 0) > settings.tds.thresholdPaise
    const blocker =
      owed <= 0 || owed < settings.minPayoutPaise
        ? 'below_minimum'
        : !r.payoutHint
          ? 'no_details'
          : panNeeded
            ? 'no_pan'
            : null
    return {
      affiliateId: r.affiliateId,
      name: r.name,
      code: r.code,
      payoutHint: r.payoutHint,
      grossPaise: r.gross,
      tdsPaise: r.tds,
      clawbackPaise,
      gstPaise,
      gstRegistered: r.gstRegistered,
      netPaise: payoutNetPaise({
        grossPaise: r.gross,
        clawbackPaise,
        gstPaise,
        tdsPaise: r.tds,
      }),
      commissions: r.n,
      ready: blocker === null,
      blocker,
    }
  })
}

/**
 * One pending payout per ready affiliate (or the ones asked for), holding their approved
 * commissions. Commissions stay `approved` until the payout is marked paid.
 */
export async function createPayouts(
  tx: StoreTx,
  storeId: string,
  settings: StoreAffiliateSettings,
  affiliateIds?: string[],
): Promise<PayoutRow[]> {
  const ready = (await payoutCandidates(tx, settings)).filter(
    (c) => c.ready && (!affiliateIds || affiliateIds.includes(c.affiliateId)),
  )
  const made: PayoutRow[] = []
  for (const c of ready) {
    const [p] = await tx
      .insert(affiliatePayout)
      .values({
        storeId,
        affiliateId: c.affiliateId,
        grossPaise: c.grossPaise,
        tdsPaise: c.tdsPaise,
        clawbackPaise: c.clawbackPaise,
        gstPaise: c.gstPaise,
        netPaise: c.netPaise,
      })
      .returning()
    if (!p) continue
    if (c.clawbackPaise > 0) {
      await tx
        .update(affiliateCommission)
        .set({ clawbackPayoutId: p.id, updatedAt: new Date() })
        .where(
          and(
            eq(affiliateCommission.affiliateId, c.affiliateId),
            sql`${affiliateCommission.clawbackPaise} > 0`,
            isNull(affiliateCommission.clawbackPayoutId),
          ),
        )
    }
    await tx
      .update(affiliateCommission)
      .set({ payoutId: p.id, updatedAt: new Date() })
      .where(
        and(
          eq(affiliateCommission.affiliateId, c.affiliateId),
          eq(affiliateCommission.status, 'approved'),
          isNull(affiliateCommission.payoutId),
        ),
      )
    made.push(p)
  }
  return made
}

/** The merchant paid it (UPI, bank transfer): its commissions become paid and the affiliate is told. */
export async function markPayoutPaid(
  tx: StoreTx,
  storeId: string,
  payoutId: string,
  reference: string,
  now = new Date(),
): Promise<PayoutRow> {
  const [p] = await tx
    .update(affiliatePayout)
    .set({ status: 'paid', paidAt: now, reference: reference.trim().slice(0, 120) })
    .where(and(eq(affiliatePayout.id, payoutId), eq(affiliatePayout.status, 'pending')))
    .returning()
  if (!p) throw new AffiliateError('PAYOUT_NOT_PENDING', 'This payout is not waiting to be paid')
  await tx
    .update(affiliateCommission)
    .set({ status: 'paid', updatedAt: now })
    .where(eq(affiliateCommission.payoutId, p.id))
  await insertOutboxEvent(tx, storeId, 'affiliate.payout_paid', {
    affiliateId: p.affiliateId,
    payoutId: p.id,
  })
  return p
}

/** Undoes a pending payout; its commissions go back to waiting. */
export async function cancelPayout(tx: StoreTx, payoutId: string): Promise<void> {
  const [p] = await tx
    .select()
    .from(affiliatePayout)
    .where(and(eq(affiliatePayout.id, payoutId), eq(affiliatePayout.status, 'pending')))
  if (!p) throw new AffiliateError('PAYOUT_NOT_PENDING', 'This payout is not waiting to be paid')
  await tx
    .update(affiliateCommission)
    .set({ payoutId: null, updatedAt: new Date() })
    .where(eq(affiliateCommission.payoutId, p.id))
  await tx
    .update(affiliateCommission)
    .set({ clawbackPayoutId: null, updatedAt: new Date() })
    .where(eq(affiliateCommission.clawbackPayoutId, p.id))
  await tx.delete(affiliatePayout).where(eq(affiliatePayout.id, p.id))
}

export type PayoutListItem = PayoutRow & { name: string; code: string; payoutHint: string | null }

export async function listPayouts(tx: StoreTx, limit = 500): Promise<PayoutListItem[]> {
  const rows = await tx
    .select({
      p: affiliatePayout,
      name: affiliate.name,
      code: affiliate.code,
      hint: affiliate.payoutHint,
    })
    .from(affiliatePayout)
    .innerJoin(affiliate, eq(affiliate.id, affiliatePayout.affiliateId))
    .orderBy(desc(affiliatePayout.createdAt))
    .limit(limit)
  return rows.map((r) => ({ ...r.p, name: r.name, code: r.code, payoutHint: r.hint }))
}

/** A CSV cell: quoted, inner quotes doubled, and no formula injection in a spreadsheet. */
export function csvCell(v: string | number): string {
  const s = String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

export const rupees = (paise: number) => (paise / 100).toFixed(2)

/**
 * Pending payouts as a CSV for a bank's bulk upload (or paying UPI IDs by hand): the decrypted
 * details go into the file only, never a log. Rows without readable details say so.
 */
export async function payoutsCsv(
  tx: StoreTx,
  secret: string,
  payoutIds?: string[],
): Promise<string> {
  const rows = await tx
    .select({ p: affiliatePayout, a: affiliate })
    .from(affiliatePayout)
    .innerJoin(affiliate, eq(affiliate.id, affiliatePayout.affiliateId))
    .where(
      payoutIds?.length
        ? inArray(affiliatePayout.id, payoutIds)
        : eq(affiliatePayout.status, 'pending'),
    )
    .orderBy(affiliatePayout.createdAt)
  const head = [
    'Payout reference',
    'Beneficiary name',
    'Method',
    'Account number',
    'IFSC',
    'UPI ID',
    'PAN',
    'GSTIN',
    'Gross (INR)',
    'TDS (INR)',
    'Clawback (INR)',
    'GST (INR)',
    'Amount to pay (INR)',
    'Email',
  ]
  const lines = [head.map(csvCell).join(',')]
  for (const { p, a } of rows) {
    const d = readPayoutDetails(a, secret)
    lines.push(
      [
        `AFF-${p.id.slice(-8).toUpperCase()}`,
        d?.method === 'bank' ? d.accountName : a.name,
        d?.method ?? 'missing',
        d?.method === 'bank' ? d.accountNumber : '',
        d?.method === 'bank' ? d.ifsc : '',
        d?.method === 'upi' ? d.upiId : '',
        d?.pan ?? '',
        d?.gstin ?? '',
        rupees(p.grossPaise),
        rupees(p.tdsPaise),
        rupees(p.clawbackPaise),
        rupees(p.gstPaise),
        rupees(p.netPaise),
        a.email ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}
