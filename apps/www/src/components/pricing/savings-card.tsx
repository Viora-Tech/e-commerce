import { siteConfig } from '@commerce/config/site'
import { pricingContent } from '@/data/pricing'
import { formatCount, formatInr, PLATFORM_FEE_RATE } from '@/lib/pricing-math'

type SavingsCardProps = { orders: number; aov: number }

const copy = pricingContent.page.calculator

/** ILLUSTRATIVE: what a ~2% platform transaction fee would cost against the platform's 0%. */
export default function SavingsCard({ orders, aov }: SavingsCardProps) {
  // Render logic
  const sales = orders * aov
  const fee = Math.round(sales * PLATFORM_FEE_RATE)

  return (
    <div className="surface-glass flex flex-col gap-5 rounded-3xl p-6 md:p-8">
      <p className="text-eyebrow">{copy.keepLabel}</p>
      <p className="text-4xl font-semibold text-foreground tabular-nums md:text-5xl">
        ≈ {formatInr(fee)} / month
      </p>
      <p className="text-sm text-muted-foreground">
        On ≈ {formatInr(sales)} in sales ({formatCount(orders)} orders × {formatInr(aov)}), a ~2%
        platform transaction fee would cost about {formatInr(fee)} a month. {siteConfig.brand.name}{' '}
        charges 0%.
      </p>
      <dl className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>{copy.platformFee}</dt>
            <dd>{formatInr(fee)}</dd>
          </div>
          <div className="h-2 rounded-full bg-foreground/70" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>{copy.thisPlatform}</dt>
            <dd>{copy.zero}</dd>
          </div>
          <div className="h-2 rounded-full bg-muted" />
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{copy.illustrative}</p>
    </div>
  )
}
