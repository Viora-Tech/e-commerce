import type { DashboardSummary } from '@commerce/api'
import { Sparkle } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import { homeContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { INTL_LOCALE, type Locale } from '@/lib/i18n'

type InsightsListProps = {
  insight: DashboardSummary['insight']
  needsYou: DashboardSummary['needsYou']
  streakDays: number
}

const PERCENT_OPTIONS = { style: 'percent', maximumFractionDigits: 0 } as const
const PERCENT: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat(INTL_LOCALE.en, PERCENT_OPTIONS),
  hi: new Intl.NumberFormat(INTL_LOCALE.hi, PERCENT_OPTIONS),
}

/** Plain sentences built from real numbers: sales trend, best seller, low stock, streak. */
function buildLines(
  input: InsightsListProps,
  c: (typeof homeContent)['insights'],
  locale: Locale,
): string[] {
  const lines: string[] = []
  if (input.insight.salesChange !== null) {
    const pct = PERCENT[locale].format(Math.abs(input.insight.salesChange))
    if (input.insight.salesChange > 0.02) lines.push(c.salesUp(pct, c.comparedToLastWeek))
    else if (input.insight.salesChange < -0.02) lines.push(c.salesDown(pct, c.comparedToLastWeek))
    else lines.push(c.salesFlat)
  }
  if (input.insight.bestSeller) {
    lines.push(c.bestSeller(input.insight.bestSeller.title, input.insight.bestSeller.units))
  }
  if (input.needsYou.lowStock.count > 0) {
    lines.push(c.lowStockNudge(input.needsYou.lowStock.count))
  }
  if (input.streakDays > 0) {
    lines.push(c.streak(input.streakDays))
  }
  return lines.slice(0, 4)
}

/** 2 to 4 plain-language reads on the week, no charts: what a busy owner wants to know. */
export default async function InsightsList({ insight, needsYou, streakDays }: InsightsListProps) {
  // Render logic
  const locale = await getLocale()
  const c = (await getCopy(homeContent)).insights
  const lines = buildLines({ insight, needsYou, streakDays }, c, locale)

  return (
    <DataCard title={c.title}>
      {lines.length === 0 ? (
        <p className="text-body text-muted-foreground">{c.noData}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Sparkle className="mt-0.5 size-4 shrink-0 text-primary" weight="fill" />
              <p className="text-body text-ink-strong">{line}</p>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
