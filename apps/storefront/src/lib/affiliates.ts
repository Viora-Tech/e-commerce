import 'server-only'
import type { SignedInCustomer } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  affiliateForCustomer,
  affiliateState,
  affiliateTotals,
  commissionLedger,
  recordAffiliateClick,
} from '@commerce/plugin-affiliates/server'
import { inStore } from './store-context'

/** Counts a click on an affiliate's `?ref=` link, only while the store has the app. */
export async function countAffiliateClick(
  tx: StoreTx,
  storeId: string,
  code: string,
): Promise<void> {
  if (!(await affiliateState(tx, storeId)).installed) return
  await recordAffiliateClick(tx, storeId, code)
}

export type AffiliatePortal = {
  program: {
    active: boolean
    pitch: string
    terms: string
    couponPercent: number | null
    cookieDays: number
    holdDays: number
  }
  affiliate: {
    status: 'pending' | 'approved' | 'rejected' | 'suspended'
    name: string
    code: string
    couponCode: string | null
    payoutHint: string | null
    hasPan: boolean
  } | null
  totals: Awaited<ReturnType<typeof affiliateTotals>> | null
  /** Recent commissions: date, amount and where they stand. No shopper details. */
  recent: { id: string; placedAt: Date; commissionPaise: number; status: string }[]
}

/**
 * What `/affiliate` draws for this shopper: the program, and their own affiliate record and
 * figures when they have one. Null when the store does not have the Affiliates app.
 */
export async function loadAffiliatePortal(
  storeId: string,
  me: SignedInCustomer | null,
): Promise<AffiliatePortal | null> {
  return inStore(storeId, async (tx) => {
    const { installed, settings } = await affiliateState(tx, storeId)
    if (!installed) return null
    const program = {
      active: settings.active,
      pitch: settings.pitch,
      terms: settings.terms,
      couponPercent: settings.coupon.enabled ? settings.coupon.bp / 100 : null,
      cookieDays: settings.cookieDays,
      holdDays: settings.holdDays,
    }
    const row = me ? await affiliateForCustomer(tx, storeId, me.id) : null
    if (!row) return { program, affiliate: null, totals: null, recent: [] }
    const approved = row.status === 'approved'
    const [totals, ledger] = approved
      ? await Promise.all([
          affiliateTotals(tx, row.id),
          commissionLedger(tx, { affiliateId: row.id, limit: 20 }),
        ])
      : [null, []]
    return {
      program,
      affiliate: {
        status: row.status,
        name: row.name,
        code: row.code,
        couponCode: row.couponCode,
        payoutHint: row.payoutHint,
        hasPan: row.hasPan,
      },
      totals,
      recent: ledger.map((c) => ({
        id: c.id,
        placedAt: c.placedAt,
        commissionPaise: c.commissionPaise,
        status: c.status,
      })),
    }
  })
}
