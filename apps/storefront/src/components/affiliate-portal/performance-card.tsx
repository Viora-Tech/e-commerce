'use client'

import { formatInZone } from '@commerce/dates'
import StackedAreaChart from '@commerce/ui/global/area-chart'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { affiliatePortalContent } from '@/data/affiliate-portal'

type Range = '7d' | '30d' | '90d' | 'all'

type PerformanceCardProps = {
  range: Range
  points: { period: string; referrals: number; clicks: number }[]
  unit: 'day' | 'week' | 'month'
}

const copy = affiliatePortalContent.dashboard.performance

/** dashboard-01's order: the longest range first. */
const RANGES: Range[] = ['all', '90d', '30d', '7d']

/** A period's label on the axis: "26 Nov", or "Nov 2026" for months. */
function axisLabel(period: string, unit: PerformanceCardProps['unit']): string {
  const d = new Date(`${period}T00:00:00Z`)
  return unit === 'month'
    ? formatInZone(d, { month: 'short', year: 'numeric' }, { timeZone: 'UTC' })
    : formatInZone(d, { day: 'numeric', month: 'short' }, { timeZone: 'UTC' })
}

/**
 * dashboard-01's ChartAreaInteractive: clicks and referrals over the range as two areas, with
 * the time range as a toggle (a select on a narrow card). The range lives in the URL
 * (`?range=`), so the page loads its figures again on the server.
 */
export default function PerformanceCard({ range, points, unit }: PerformanceCardProps) {
  // Hooks
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  // Event handlers
  const handleRange = (value: string | undefined) => {
    if (!value || value === range) return
    const next = new URLSearchParams(params.toString())
    if (value === '30d') next.delete('range')
    else next.set('range', value)
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Render logic
  const data = points.map((p) => ({
    label: axisLabel(p.period, unit),
    clicks: p.clicks,
    referrals: p.referrals,
  }))
  return (
    <div className="px-4 lg:px-6">
      <Card className="@container/card">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.total(copy.ranges[range] ?? '')}</CardDescription>
          <CardAction>
            <ToggleGroup
              variant="outline"
              spacing={0}
              value={[range]}
              onValueChange={(v: string[]) => handleRange(v[0])}
              className="hidden *:data-[slot=toggle-group-item]:px-4 @[48rem]/card:flex"
            >
              {RANGES.map((r) => (
                <ToggleGroupItem key={r} value={r}>
                  {copy.ranges[r]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <NativeSelect
              size="sm"
              aria-label={copy.range}
              value={range}
              onChange={(e) => handleRange(e.target.value)}
              className="w-40 @[48rem]/card:hidden"
            >
              {RANGES.map((r) => (
                <NativeSelectOption key={r} value={r}>
                  {copy.ranges[r]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <StackedAreaChart
            data={data}
            series={[
              { key: 'clicks', label: copy.series.clicks },
              { key: 'referrals', label: copy.series.referrals },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
