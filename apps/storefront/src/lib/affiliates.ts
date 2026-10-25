import 'server-only'
import type { SignedInCustomer } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  affiliateForCustomer,
  affiliateState,
  affiliateTotals,
  affiliateTrend,
  commissionLedger,
  defaultProgram,
  listCreatives,
  programBySlug,
  programOf,
  recordAffiliateClick,
  type SignupField,
  type TrendPoint,
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
    /** `?program=` value for links back to this signup page. */
    slug: string
    isDefault: boolean
    active: boolean
    pitch: string
    terms: string
    couponPercent: number | null
    cookieDays: number
    holdDays: number
    /** Extra questions on the signup page. */
    form: SignupField[]
  }
  affiliate: {
    status: 'pending' | 'approved' | 'rejected' | 'suspended'
    name: string
    code: string
    couponCode: string | null
    payoutHint: string | null
    hasPan: boolean
    codeRequest: { code: string; status: 'pending' | 'approved' | 'declined' } | null
  } | null
  totals: Awaited<ReturnType<typeof affiliateTotals>> | null
  /** Recent commissions: date, amount and where they stand. No shopper details. */
  recent: { id: string; placedAt: Date; commissionPaise: number; status: string }[]
  /** Images and captions to post (their program's and the all-programs ones). */
  creatives: {
    id: string
    url: string
    contentType: string | null
    title: string
    caption: string
  }[]
  /** Their last 12 months: orders, commission and clicks per month. */
  trend: TrendPoint[]
}

/**
 * What `/affiliate` draws for this shopper: the program (their own once they joined, else the
 * one `?program=` names, else the default), and their own affiliate record and figures when they
 * have one. Null when the store does not have the Affiliates app, or `?program=` names no open
 * program.
 */
export async function loadAffiliatePortal(
  storeId: string,
  me: SignedInCustomer | null,
  programSlug?: string | undefined,
): Promise<AffiliatePortal | null> {
  return inStore(storeId, async (tx) => {
    const { installed, settings } = await affiliateState(tx, storeId)
    if (!installed) return null
    const row = me ? await affiliateForCustomer(tx, storeId, me.id) : null
    const chosen = row
      ? await programOf(tx, storeId, row)
      : programSlug
        ? await programBySlug(tx, storeId, programSlug)
        : await defaultProgram(tx, storeId)
    if (!chosen) return null
    const rules = chosen.rules
    const program = {
      slug: chosen.slug,
      isDefault: chosen.isDefault,
      active: settings.active,
      pitch: rules.pitch,
      terms: rules.terms,
      couponPercent: rules.coupon.enabled ? rules.coupon.bp / 100 : null,
      cookieDays: settings.cookieDays,
      holdDays: settings.holdDays,
      form: rules.form,
    }
    if (!row)
      return { program, affiliate: null, totals: null, recent: [], creatives: [], trend: [] }
    const approved = row.status === 'approved'
    const [totals, ledger, creatives, trend] = approved
      ? await Promise.all([
          affiliateTotals(tx, row.id),
          commissionLedger(tx, { affiliateId: row.id, limit: 20 }),
          listCreatives(tx, { programId: chosen.id }),
          affiliateTrend(tx, { by: 'month', affiliateId: row.id }),
        ])
      : [null, [], [], []]
    return {
      program,
      affiliate: {
        status: row.status,
        name: row.name,
        code: row.code,
        couponCode: row.couponCode,
        payoutHint: row.payoutHint,
        hasPan: row.hasPan,
        codeRequest: row.codeRequest
          ? { code: row.codeRequest.code, status: row.codeRequest.status }
          : null,
      },
      totals,
      recent: ledger.map((c) => ({
        id: c.id,
        placedAt: c.placedAt,
        commissionPaise: c.commissionPaise,
        status: c.status,
      })),
      creatives: creatives.map((c) => ({
        id: c.id,
        url: c.url,
        contentType: c.contentType,
        title: c.title,
        caption: c.caption,
      })),
      trend,
    }
  })
}
