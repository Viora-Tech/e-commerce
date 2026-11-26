import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import type { ActivityTotals } from '@/lib/portal-data'
import { money } from '@/lib/portal-format'

type SectionCardsProps = {
  current: ActivityTotals
  /** The same span just before, for the trend badges; null for "since you joined". */
  previous: ActivityTotals | null
  /** "Last 30 days", for the footers. */
  rangeLabel: string
}

const copy = affiliatePortalContent.dashboard.cards

/** Change against the period before, as a whole percent; null when there is nothing to compare. */
function change(now: number, before: number | undefined): number | null {
  if (before === undefined || before === 0) return null
  return Math.round(((now - before) / before) * 100)
}

/** Orders per click, as a percent with one decimal. */
const conversion = (t: ActivityTotals) => (t.clicks > 0 ? (t.referrals / t.clicks) * 100 : 0)

/**
 * dashboard-01's SectionCards: commission, referrals, clicks and conversion for the range, each
 * with its change against the period before and a plain line about what it counts.
 */
export default function SectionCards({ current, previous, rangeLabel }: SectionCardsProps) {
  // Render logic
  const cards = [
    {
      label: copy.commission,
      value: money(current.commissionPaise),
      delta: change(current.commissionPaise, previous?.commissionPaise),
      note: copy.commissionNote(money(current.salesPaise)),
    },
    {
      label: copy.referrals,
      value: current.referrals.toLocaleString('en-IN'),
      delta: change(current.referrals, previous?.referrals),
      note: copy.referralsNote,
    },
    {
      label: copy.clicks,
      value: current.clicks.toLocaleString('en-IN'),
      delta: change(current.clicks, previous?.clicks),
      note: copy.clicksNote,
    },
    {
      label: copy.conversion,
      value: `${conversion(current).toFixed(1)}%`,
      delta: previous ? change(conversion(current), conversion(previous)) : null,
      note: copy.conversionNote,
    },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="@container/card">
          <CardHeader>
            <CardDescription>{c.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[15.625rem]/card:text-3xl">
              {c.value}
            </CardTitle>
            {c.delta !== null ? (
              <CardAction>
                <Badge variant="outline">
                  {c.delta >= 0 ? <ArrowUp /> : <ArrowDown />}
                  {c.delta >= 0 ? `+${c.delta}%` : `${c.delta}%`}
                </Badge>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 border-t-0 bg-transparent pt-0 text-sm">
            <div className="line-clamp-1 font-medium">
              {c.delta === null ? rangeLabel : c.delta >= 0 ? copy.up : copy.down}
            </div>
            <div className="text-muted-foreground">{c.note}</div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
