import { monthlyCost } from '@commerce/core/billing'
import { pricingContent } from '@/data/pricing'
import { formatCount, formatInr, PLATFORM_FEE_RATE, recommendedPlan } from '@/lib/pricing-math'
import CountUp from '../common/count-up'

type SavingsCardProps = { orders: number; aov: number }

const copy = pricingContent.page.calculator

/** ILLUSTRATIVE: the cheapest plan's monthly total (plan plus per-order fees) against a 2% cut. */
export default function SavingsCard({ orders, aov }: SavingsCardProps) {
  // Render logic
  const plan = recommendedPlan(orders, aov)
  const cost = monthlyCost(plan.key, orders, aov)
  const sales = orders * aov
  const cut = Math.round(sales * PLATFORM_FEE_RATE)
  const widest = Math.max(cost.totalInr, cut, 1)

  return (
    <div className="glass-panel flex flex-col gap-5 rounded-3xl p-6 md:p-8">
      <p className="text-eyebrow">{copy.costLabel}</p>
      <p className="text-4xl font-semibold text-foreground tabular-nums md:text-5xl">
        <CountUp value={cost.totalInr} currency /> / month
      </p>
      <p className="text-sm text-muted-foreground">
        {copy.breakdown(formatInr(sales), formatCount(orders), formatInr(aov))}
      </p>
      <dl className="flex flex-col gap-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <dt>{copy.planPrice(plan.name)}</dt>
          <dd>{formatInr(cost.planInr)}</dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>{copy.perOrderFee}</dt>
            <dd>{formatInr(cost.feeInr)}</dd>
          </div>
          <div aria-hidden className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-cta"
              style={{ width: `${(cost.totalInr / widest) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>{copy.twoPercent}</dt>
            <dd>{formatInr(cut)}</dd>
          </div>
          <div aria-hidden className="h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{ width: `${(cut / widest) * 100}%` }}
            />
          </div>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{copy.illustrative}</p>
    </div>
  )
}
