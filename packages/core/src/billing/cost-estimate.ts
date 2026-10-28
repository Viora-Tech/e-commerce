/** SOURCE OF TRUTH: monthly cost estimate — WHAT a store of a given size pays a month on each
 * plan, plan price plus per-order fees / WHY the pricing page's calculator and its plan pick
 * use the same rates billing charges (`usage-fee.ts`). Before GST, in whole rupees. Client-safe.
 */
import { PLAN_IDS, PLANS, type PlanId } from './plans'

/** Monthly price plus the fee on every order past the plan's included ones, at `avgOrderInr` each. */
export function monthlyCost(
  plan: PlanId,
  orders: number,
  avgOrderInr: number,
): { planInr: number; feeInr: number; totalInr: number } {
  const p = PLANS[plan]
  const planInr = p.pricePaise.month / 100
  const feeOrders = Math.max(0, orders - p.orders)
  const feeInr = Math.round((feeOrders * avgOrderInr * p.feeBasisPoints) / 10_000)
  return { planInr, feeInr, totalInr: planInr + feeInr }
}

/** The plan with the lowest monthly total for this many orders; a tie goes to the smaller plan. */
export function bestPlan(orders: number, avgOrderInr: number): PlanId {
  let best: PlanId = 'starter'
  for (const plan of PLAN_IDS) {
    if (
      monthlyCost(plan, orders, avgOrderInr).totalInr <
      monthlyCost(best, orders, avgOrderInr).totalInr
    )
      best = plan
  }
  return best
}
