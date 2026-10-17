import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { pricingContent as copy, type Plan } from '@/data/pricing'
import Reveal from '../common/reveal'
import JoinWaitlistButton from '../waitlist/join-waitlist-button'

type PlanCardProps = {
  plan: Plan
  /** Replaces the "Most popular" badge, e.g. "Recommended for you" on the pricing page. */
  badge?: string
  /** "100 orders a month" on the home page; "Up to 100 orders a month" on the pricing page. */
  upTo?: boolean
  step?: number
}

export default function PlanCard({ plan, badge, upTo = false, step = 0 }: PlanCardProps) {
  // Render logic
  const label = badge ?? (plan.popular ? copy.mostPopular : null)
  const orders = `${upTo ? `${copy.upTo} ` : ''}${plan.ordersPerMonth.toLocaleString('en-IN')} ${copy.ordersAMonth}`

  return (
    <Reveal
      as="article"
      step={step}
      className={cn(
        'surface-card card-lift flex flex-col gap-6 rounded-3xl p-7',
        plan.popular && 'border border-cta',
      )}
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
        {label ? (
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs font-medium',
              plan.popular
                ? 'border-cta bg-cta/10 text-cta'
                : 'border-border bg-muted text-muted-foreground',
            )}
          >
            {label}
          </span>
        ) : null}
      </header>
      <div>
        <p className="flex items-baseline gap-2">
          <span className="text-5xl font-semibold tracking-tight text-foreground">
            {copy.pricePlaceholder}
          </span>
          <span className="text-sm text-muted-foreground">{copy.perMonth}</span>
        </p>
        <p className="mt-3 text-sm text-foreground">{orders}</p>
      </div>
      <ul className="flex flex-1 flex-col gap-3 border-t border-border pt-5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-foreground">
            <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            {feature}
          </li>
        ))}
      </ul>
      <JoinWaitlistButton variant={plan.popular ? 'cta' : 'outline'} size="lg" className="w-full" />
    </Reveal>
  )
}
