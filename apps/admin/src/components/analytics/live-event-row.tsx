import type { AnalyticsLive } from '@commerce/api'
import { ShoppingBag, ShoppingCart } from '@commerce/ui/icons'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import { formatWhen } from '@/lib/format-date'
import { formatPaise } from '@/lib/money'

type LiveEventRowProps = { event: AnalyticsLive['events'][number] }

/** One line of the live feed: an order placed or a cart started. */
export default function LiveEventRow({ event }: LiveEventRowProps) {
  // Hooks
  const copy = useCopy(analyticsContent)

  // Render logic
  const c = copy.live
  const isOrder = event.kind === 'order'
  const Icon = isOrder ? ShoppingBag : ShoppingCart

  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
          isOrder ? 'bg-success/10 text-success' : 'bg-primary-soft text-primary'
        }`}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-foreground">
          {isOrder ? c.orderEvent(event.label) : c.cartEvent(event.label)}
        </span>
        <span className="block text-period text-muted-foreground-soft">{formatWhen(event.at)}</span>
      </span>
      {event.valuePaise === null ? null : (
        <span className="shrink-0 text-body text-ink-strong tabular-nums">
          {formatPaise(event.valuePaise)}
        </span>
      )}
    </li>
  )
}
