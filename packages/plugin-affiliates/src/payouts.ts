/** SOURCE OF TRUTH: affiliate payouts — WHAT: grouping approved commissions, marking them paid, the bank bulk-upload CSV / WHY: no money moves in the platform; the merchant pays outside and records it here */
import { insertOutboxEvent } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { readPayoutDetails } from './affiliates'
import { affiliate, affiliateCommission, affiliatePayout } from './schema'
import type { AffiliateSettings } from './settings'
import { AffiliateError } from './store-settings'

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
  netPaise: number
  commissions: number
  /** Over the minimum payout and has payout details saved. */
  ready: boolean
  /** Why not, when not ready. */
  blocker: 'below_minimum' | 'no_details' | null
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
  settings: AffiliateSettings,
): Promise<PayoutCandidate[]> {
  const clawbacks = await openClawbacks(tx)
  const rows = await tx
    .select({
      affiliateId: affiliateCommission.affiliateId,
      name: affiliate.name,
      code: affiliate.code,
      payoutHint: affiliate.payoutHint,
      gross: sql<number>`sum(${affiliateCommission.commissionPaise})::int`,
      tds: sql<number>`sum(${affiliateCommission.tdsPaise})::int`,
      n: sql<number>`count(*)::int`,
    })
    .from(affiliateCommission)
    .innerJoin(affiliate, eq(affiliate.id, affiliateCommission.affiliateId))
    .where(and(eq(affiliateCommission.status, 'approved'), isNull(affiliateCommission.payoutId)))
    .groupBy(affiliateCommission.affiliateId, affiliate.name, affiliate.code, affiliate.payoutHint)
  return rows.map((r) => {
    const clawbackPaise = Math.min(clawbacks.get(r.affiliateId) ?? 0, r.gross)
    const owed = r.gross - clawbackPaise
    const blocker =
      owed <= 0 || owed < settings.minPayoutPaise
        ? 'below_minimum'
        : !r.payoutHint
          ? 'no_details'
          : null
    return {
      affiliateId: r.affiliateId,
      name: r.name,
      code: r.code,
      payoutHint: r.payoutHint,
      grossPaise: r.gross,
      tdsPaise: r.tds,
      clawbackPaise,
      netPaise: Math.max(0, owed - r.tds),
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
  settings: AffiliateSettings,
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
function cell(v: string | number): string {
  const s = String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

const rupees = (paise: number) => (paise / 100).toFixed(2)

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
    'Gross (INR)',
    'TDS (INR)',
    'Clawback (INR)',
    'Amount to pay (INR)',
    'Email',
  ]
  const lines = [head.map(cell).join(',')]
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
        rupees(p.grossPaise),
        rupees(p.tdsPaise),
        rupees(p.clawbackPaise),
        rupees(p.netPaise),
        a.email ?? '',
      ]
        .map(cell)
        .join(','),
    )
  }
  return `${lines.join('\r\n')}\r\n`
}
