/** SOURCE OF TRUTH: buy X get Y discount amount — WHAT: how many times a cart qualifies (items bought or amount spent from the "buys" products or collections) and what the "gets" items take off, cheapest first / WHY: Shopify's Buy X get Y type; the evaluator in `evaluate.ts` calls it so checkout, the order and tests share one sum */
import type { DiscountBxgy } from '@commerce/db'
import { roundToWholeUnit } from '@commerce/money'
import type { DiscountCartLine } from './evaluate'

type Unit = { pricePaise: number; buys: boolean; gets: boolean }

const inScope = (
  line: DiscountCartLine,
  scope: { appliesTo: 'products' | 'collections'; ids: string[] },
): boolean =>
  scope.appliesTo === 'products'
    ? scope.ids.includes(line.productId)
    : (line.collectionIds ?? []).some((c) => scope.ids.includes(c))

/** Off one "gets" item: a percent of its price (10000 = free) or a fixed amount, never above it. */
function unitOff(method: 'percent' | 'fixed', value: number, pricePaise: number): number {
  const raw = method === 'percent' ? roundToWholeUnit((pricePaise * value) / 10_000) : value
  return Math.max(0, Math.min(raw, pricePaise))
}

/**
 * What a buy X get Y discount takes off this cart. Each round needs the "buys" requirement
 * and `gets.quantity` further items from the "gets" scope; the cheapest qualifying items are
 * the ones discounted, and an item never counts as both bought and given. With an amount
 * requirement, every multiple of the amount spent on "buys" items earns a round. Rounds stop
 * at `maxUsesPerOrder`. Zero when the cart does not qualify.
 */
export function bxgyAmount(
  lines: DiscountCartLine[],
  method: 'percent' | 'fixed',
  value: number,
  rule: DiscountBxgy,
): number {
  const units: Unit[] = lines.flatMap((l) =>
    Array.from({ length: l.quantity }, () => ({
      pricePaise: l.unitPricePaise,
      buys: inScope(l, rule.buys),
      gets: inScope(l, rule.gets),
    })),
  )
  const getsPerRound = Math.max(1, rule.gets.quantity)
  const maxRounds = rule.maxUsesPerOrder ?? Number.POSITIVE_INFINITY
  // Cheapest first for the free items, dearest first for what pays for them.
  const getPool = units.filter((u) => u.gets).sort((a, b) => a.pricePaise - b.pricePaise)

  if (rule.buys.kind === 'amount') {
    const spent = units.filter((u) => u.buys).reduce((n, u) => n + u.pricePaise, 0)
    const earned = rule.buys.amountPaise > 0 ? Math.floor(spent / rule.buys.amountPaise) : 0
    // A partly filled last round still discounts the items it found, like Shopify.
    const limit = Math.min(earned, maxRounds) * getsPerRound
    return getPool.slice(0, limit).reduce((n, u) => n + unitOff(method, value, u.pricePaise), 0)
  }

  const buysPerRound = Math.max(1, rule.buys.quantity)
  const used = new Set<Unit>()
  let amount = 0
  let rounds = 0
  while (rounds < maxRounds) {
    const gets = getPool.filter((u) => !used.has(u)).slice(0, getsPerRound)
    if (gets.length < getsPerRound) break
    const buys = units
      .filter((u) => u.buys && !used.has(u) && !gets.includes(u))
      .sort((a, b) => b.pricePaise - a.pricePaise)
      .slice(0, buysPerRound)
    if (buys.length < buysPerRound) break
    for (const u of [...gets, ...buys]) used.add(u)
    amount += gets.reduce((n, u) => n + unitOff(method, value, u.pricePaise), 0)
    rounds++
  }
  return amount
}
