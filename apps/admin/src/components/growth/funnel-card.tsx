'use client'

import type { StoreFunnel } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import { growthAttributionContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'

type FunnelCardProps = {
  funnel: StoreFunnel
}

/** Each step's share of the one before, as a whole percent; null when the step before is empty. */
function share(part: number, whole: number): string | null {
  if (whole <= 0) return null
  return `${Math.round((part / whole) * 100)}%`
}

/**
 * Visits → added to cart → reached checkout → ordered for the period (#1023): the bar shows each
 * step against visits, the caption its share of the step before.
 */
export default function FunnelCard({ funnel }: FunnelCardProps) {
  // Hooks
  const { funnel: copy } = useCopy(growthAttributionContent)
  const fmt = useFormat()

  // Render logic
  const steps = [
    { id: 'visits', label: copy.visits, value: funnel.visits, before: null },
    { id: 'cart', label: copy.addedToCart, value: funnel.addedToCart, before: funnel.visits },
    {
      id: 'checkout',
      label: copy.reachedCheckout,
      value: funnel.reachedCheckout,
      before: funnel.addedToCart,
    },
    { id: 'ordered', label: copy.ordered, value: funnel.ordered, before: funnel.reachedCheckout },
  ]
  const top = Math.max(funnel.visits, funnel.addedToCart, 1)

  return (
    <Card inset={5} gap={4}>
      <div className="flex flex-col gap-1">
        <p className="text-body-strong text-foreground">{copy.title}</p>
        <p className="text-caption text-muted-foreground">{copy.body}</p>
      </div>
      {funnel.visits === 0 && funnel.addedToCart === 0 ? (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {steps.map((s) => {
            const pct = s.before === null ? null : share(s.value, s.before)
            return (
              <li key={s.id} className="flex flex-col gap-2">
                <span className="text-caption text-muted-foreground">{s.label}</span>
                <span className="text-stat tabular-nums text-foreground">
                  {fmt.number(s.value)}
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max((s.value / top) * 100, s.value > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span className="text-caption text-muted-foreground">
                  {pct ? copy.ofPrevious(pct) : ' '}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
