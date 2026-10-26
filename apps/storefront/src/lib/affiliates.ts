import 'server-only'
import type { SignedInCustomer } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  affiliateForCustomer,
  affiliateState,
  affiliateTotals,
  affiliateTrend,
  type CommissionRule,
  defaultProgram,
  listCreatives,
  type PayoutOutlook,
  type PortalPayout,
  type PortalRange,
  type PortalSale,
  type PortalStats,
  payoutOutlook,
  portalPayouts,
  portalSales,
  portalStats,
  programBySlug,
  programOf,
  programRate,
  rangeStart,
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
    /** What the program pays on the default rule, and the best percent its levels or tiers reach. */
    rate: { rule: CommissionRule; upToBp: number | null }
    /** Some products or collections earn a different rate. */
    hasOverrides: boolean
    scope: 'first_order' | 'lifetime'
    lifetimeDays: number
    couponPercent: number | null
    cookieDays: number
    holdDays: number
    minPayoutPaise: number
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
    appliedAt: Date
    /** Why the store declined them, when it said. */
    rejectReason: string | null
    codeRequest: { code: string; status: 'pending' | 'approved' | 'declined' } | null
  } | null
  /** All-time balances: pending, ready to pay, paid. */
  totals: Awaited<ReturnType<typeof affiliateTotals>> | null
  /** The date range the figures below are for. */
  range: PortalRange
  stats: PortalStats | null
  /** Their newest referred orders, the buyer masked. */
  recent: PortalSale[]
  payouts: PortalPayout[]
  outlook: PayoutOutlook | null
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
  range: PortalRange = '30d',
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
      // Their own rate, when the store set one, is what they earn.
      rate: row?.rateOverride ? { rule: row.rateOverride, upToBp: null } : programRate(rules),
      hasOverrides: rules.overrides.length > 0,
      scope: rules.scope,
      lifetimeDays: rules.lifetimeDays,
      couponPercent: rules.coupon.enabled ? rules.coupon.bp / 100 : null,
      cookieDays: settings.cookieDays,
      holdDays: settings.holdDays,
      minPayoutPaise: settings.minPayoutPaise,
      form: rules.form,
    }
    const empty = {
      totals: null,
      range,
      stats: null,
      recent: [],
      payouts: [],
      outlook: null,
      creatives: [],
      trend: [],
    }
    if (!row) return { program, affiliate: null, ...empty }
    const affiliate = {
      status: row.status,
      name: row.name,
      code: row.code,
      couponCode: row.couponCode,
      payoutHint: row.payoutHint,
      hasPan: row.hasPan,
      appliedAt: row.createdAt,
      rejectReason: row.rejectReason,
      codeRequest: row.codeRequest
        ? { code: row.codeRequest.code, status: row.codeRequest.status }
        : null,
    }
    if (row.status !== 'approved') return { program, affiliate, ...empty }
    const [totals, stats, recent, payouts, outlook, creatives, trend] = await Promise.all([
      affiliateTotals(tx, row.id),
      portalStats(tx, row.id, rangeStart(range)),
      portalSales(tx, row.id, 20),
      portalPayouts(tx, row.id, 12),
      payoutOutlook(tx, row.id, settings),
      listCreatives(tx, { programId: chosen.id }),
      affiliateTrend(tx, { by: 'month', affiliateId: row.id }),
    ])
    return {
      program,
      affiliate,
      totals,
      range,
      stats,
      recent,
      payouts,
      outlook,
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
