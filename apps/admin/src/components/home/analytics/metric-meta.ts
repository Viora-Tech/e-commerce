import type { HomeMetric } from '@commerce/core/home-metrics'
import {
  BadgePercent,
  BarChart3,
  CreditCard,
  type IconComponent,
  Package,
  ReceiptIcon,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  Undo,
  Users,
} from '@commerce/ui/icons'
import type { Formatters } from '@/lib/format'

/** How a metric reads: money in paise, a count, or a percentage (its change is in points). */
type Kind = 'money' | 'count' | 'percent'

type Meta = {
  kind: Kind
  icon: IconComponent
  /** A rise is bad news (refunds, discounts, abandoned carts): the change reads red going up. */
  lowerIsBetter?: boolean
}

/** Figma "Choose a metric for this slot": each metric's icon and how its figure reads. */
export const METRIC_META: Record<HomeMetric, Meta> = {
  sales: { kind: 'money', icon: BarChart3 },
  orders: { kind: 'count', icon: ShoppingBag },
  aov: { kind: 'money', icon: ReceiptIcon },
  visitors: { kind: 'count', icon: Users },
  conversion: { kind: 'percent', icon: TrendingUp },
  returning: { kind: 'count', icon: RefreshCw },
  gross: { kind: 'money', icon: BarChart3 },
  refunds: { kind: 'money', icon: Undo, lowerIsBetter: true },
  discounts: { kind: 'money', icon: BadgePercent, lowerIsBetter: true },
  gst: { kind: 'money', icon: ReceiptIcon },
  codShare: { kind: 'percent', icon: CreditCard },
  abandoned: { kind: 'count', icon: ShoppingCart, lowerIsBetter: true },
  shipping: { kind: 'money', icon: Truck },
  topProducts: { kind: 'count', icon: Package },
}

/** A metric's figure as text: ₹ for money, compact counts, one-decimal percentages. */
export function formatMetric(fmt: Formatters, metric: HomeMetric, value: number): string {
  const { kind } = METRIC_META[metric]
  if (kind === 'money') return fmt.money(value)
  if (kind === 'percent') return `${fmt.number(value)}%`
  return fmt.compact(value)
}

/** The change against the comparison: points for percentages, else a rounded percent. */
export function metricChange(
  metric: HomeMetric,
  value: number,
  previous: number | null,
): number | null {
  if (previous === null) return null
  if (METRIC_META[metric].kind === 'percent') return Math.round((value - previous) * 10) / 10
  if (previous <= 0) return null
  return Math.round(((value - previous) / previous) * 100)
}

/** Running totals, so a day's hourly line climbs; percentages stay as they are. */
export function shapeHourly(metric: HomeMetric, values: number[]): number[] {
  if (METRIC_META[metric].kind === 'percent') return values
  let total = 0
  return values.map((v) => {
    total += v
    return total
  })
}
