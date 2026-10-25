/** SOURCE OF TRUTH: affiliate commission maths — WHAT: net sale per line and the commission on it / WHY: the hooks, the tests and the admin preview must agree to the paisa */
import type { CommissionLevel, CommissionRule, ProgramRules, Tier } from './settings'

/**
 * Pure. An order's lines as the commission sees them. Prices are GST inclusive (Indian
 * retail), so the base is worked out without GST, after the order's discount, without
 * shipping and without gift cards (a voucher is not a sale yet).
 */
export type CommissionLine = {
  productId: string
  /** Collections the product is in, for collection overrides. */
  collectionIds: string[]
  quantity: number
  unitPricePaise: number
  gstRatePercent: number | null
  giftCard: boolean
}

export type CommissionOrder = {
  subtotalPaise: number
  discountPaise: number
  lines: CommissionLine[]
}

export type CommissionResult = {
  /** Net sale the commission is on: after discount, without GST and shipping. */
  basePaise: number
  commissionPaise: number
}

/** The rules the maths reads. Excludes and levels are optional so a v1 settings object still fits. */
export type CommissionRules = Pick<ProgramRules, 'commission' | 'overrides'> &
  Partial<Pick<ProgramRules, 'excludes' | 'levels'>>

/** A line's goods value after its share of the order discount, GST still in. */
function lineAfterDiscount(line: CommissionLine, order: CommissionOrder): number {
  if (line.giftCard || line.quantity <= 0) return 0
  const gross = line.unitPricePaise * line.quantity
  const share =
    order.subtotalPaise > 0 ? Math.round((order.discountPaise * gross) / order.subtotalPaise) : 0
  return Math.max(0, gross - share)
}

/** A line's share of the order discount, then GST taken out. */
function lineBasePaise(line: CommissionLine, order: CommissionOrder): number {
  const afterDiscount = lineAfterDiscount(line, order)
  const rate = line.gstRatePercent ?? 0
  return rate > 0 ? Math.round((afterDiscount * 100) / (100 + rate)) : afterDiscount
}

/**
 * What an order-value level is measured on: the goods after discount, GST included, without
 * shipping and gift cards. The commission itself stays on the ex-GST base.
 */
export function orderValuePaise(order: CommissionOrder): number {
  return order.lines.reduce((sum, l) => sum + lineAfterDiscount(l, order), 0)
}

/** The tier an affiliate is on for their approved sales so far, or null. Highest mark passed wins. */
export function tierFor(tiers: Tier[], approvedSalesPaise: number): Tier | null {
  let best: Tier | null = null
  for (const t of tiers) {
    if (approvedSalesPaise >= t.minSalesPaise && (!best || t.minSalesPaise >= best.minSalesPaise)) {
      best = t
    }
  }
  return best
}

/** The level an order of this value reaches, or null. Highest mark passed wins. */
export function levelFor(levels: CommissionLevel[], valuePaise: number): CommissionLevel | null {
  let best: CommissionLevel | null = null
  for (const l of levels) {
    if (valuePaise >= l.minOrderPaise && (!best || l.minOrderPaise >= best.minOrderPaise)) best = l
  }
  return best
}

function excluded(line: CommissionLine, rules: CommissionRules): boolean {
  return (rules.excludes ?? []).some((x) =>
    x.target === 'product' ? x.id === line.productId : line.collectionIds.includes(x.id),
  )
}

function ruleForLine(line: CommissionLine, rules: CommissionRules): CommissionRule | null {
  const product = rules.overrides.find((o) => o.target === 'product' && o.id === line.productId)
  if (product) return product.rule
  const collection = rules.overrides.find(
    (o) => o.target === 'collection' && line.collectionIds.includes(o.id),
  )
  return collection?.rule ?? null
}

/**
 * The rule for the lines without an override: the affiliate's own rate, else the order-value
 * level reached, else the program default.
 */
export function defaultRuleFor(
  rules: CommissionRules,
  valuePaise: number,
  rateOverride: CommissionRule | null = null,
): CommissionRule {
  return rateOverride ?? levelFor(rules.levels ?? [], valuePaise)?.rule ?? rules.commission
}

/**
 * The commission on one order. Per line, first match wins: an excluded product or collection
 * earns nothing and leaves the base; a product override, then a collection override (a flat
 * override is per unit); the rest use the default rule (the affiliate's own rate, else the
 * order-value level, else the program's), whose percent the affiliate's tier lifts and whose
 * flat amount is once per order. Never more than the base it is earned on.
 */
export function computeCommission(
  order: CommissionOrder,
  rules: CommissionRules,
  tier: Tier | null = null,
  rateOverride: CommissionRule | null = null,
): CommissionResult {
  let basePaise = 0
  let commission = 0
  let defaultBase = 0
  for (const line of order.lines) {
    if (excluded(line, rules)) continue
    const base = lineBasePaise(line, order)
    if (base <= 0) continue
    basePaise += base
    const rule = ruleForLine(line, rules)
    if (!rule) {
      defaultBase += base
      continue
    }
    commission +=
      rule.type === 'percent'
        ? Math.round((base * rule.bp) / 10_000)
        : Math.min(base, rule.paise * line.quantity)
  }
  if (defaultBase > 0) {
    const rule = defaultRuleFor(rules, orderValuePaise(order), rateOverride)
    if (rule.type === 'percent') {
      const bp = tier ? Math.max(tier.bp, rule.bp) : rule.bp
      commission += Math.round((defaultBase * bp) / 10_000)
    } else {
      commission += Math.min(defaultBase, rule.paise)
    }
  }
  return { basePaise, commissionPaise: Math.min(commission, basePaise) }
}

/**
 * What is left of a commission after part of the order was refunded: scaled by the share
 * of the order's total that stayed paid. A full refund leaves nothing.
 */
export function scaleForRefund(
  commissionPaise: number,
  orderTotalPaise: number,
  refundedPaise: number,
): number {
  if (orderTotalPaise <= 0) return 0
  const kept = Math.max(0, orderTotalPaise - refundedPaise)
  return Math.round((commissionPaise * kept) / orderTotalPaise)
}
