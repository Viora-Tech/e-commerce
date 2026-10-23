'use client'

import type { ProfitInsights } from '@commerce/api'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import StatStrip from '@/components/layout/stat-strip'
import StatusChip from '@/components/layout/status-chip'
import { profitReportContent } from '@/data/profit-report'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ProfitInsightsCardProps = { insights: ProfitInsights }

/**
 * The Profit reports' summary: net profit after monthly expenses, average profit per order, per
 * unit and by basket size, how much is still estimated, the verdict and the floor sentence
 * (design: docs/superpowers/specs/2026-10-22-profit-design.md §5).
 */
export default function ProfitInsightsCard({ insights }: ProfitInsightsCardProps) {
  // Hooks
  const copy = useCopy(profitReportContent)
  const fmt = useFormat()

  // Helpers
  const signed = (paise: number) => (paise < 0 ? `−${fmt.money(-paise)}` : fmt.money(paise))
  const amount = (paise: number | null) => (paise === null ? copy.noOrders : signed(paise))
  const monthName = (month: string) =>
    fmt.pattern(`${month}-15T12:00:00Z`, { month: 'long', year: 'numeric' })

  // Render logic
  const floor = insights.estimatedOrders > 0
  const verdict = insights.verdict
  const soFar = insights.soFar
  const headline = [
    {
      id: 'net',
      label: copy.netProfit,
      value: floor
        ? `${copy.atLeast} ${signed(insights.netProfitPaise)}`
        : signed(insights.netProfitPaise),
      note: copy.expensesNote(fmt.money(insights.expensesPaise)),
    },
    { id: 'order', label: copy.perOrder, value: amount(insights.perOrderPaise) },
    { id: 'unit', label: copy.perUnit, value: amount(insights.perUnitPaise) },
  ]
  const baskets = insights.byBasket.map((b) => ({
    id: `basket-${b.size}`,
    label: copy.basket(b.size),
    value: amount(b.perOrderPaise),
    note: copy.basketNote(b.orders),
  }))

  return (
    <DataCard
      title={copy.title}
      action={
        <StatusChip>
          {floor ? copy.estimated(insights.estimatedOrders, insights.orders) : copy.allReal}
        </StatusChip>
      }
      bodyClassName="flex flex-col gap-4"
    >
      <StatStrip tiles={headline} />
      <div className="flex flex-col gap-2">
        <p className="text-caption text-muted-foreground">
          {copy.basketTitle} · {copy.basketHelp}
        </p>
        <StatStrip tiles={baskets} />
      </div>
      <ul className="flex flex-col gap-1 text-body">
        <li className={verdict.kind === 'short' ? 'text-destructive' : 'text-foreground'}>
          {verdict.kind === 'profitable'
            ? copy.profitable
            : copy.short(fmt.money(verdict.shortPaise), verdict.ordersNeeded)}
        </li>
        {soFar ? (
          <li className="text-caption text-muted-foreground">
            {copy.soFar(
              monthName(soFar.month),
              soFar.daysCounted,
              soFar.daysInMonth,
              fmt.money(soFar.countedPaise),
              fmt.money(soFar.fullPaise),
            )}
          </li>
        ) : null}
        {floor ? (
          <li className="text-caption text-muted-foreground">{copy.estimatedHelp}</li>
        ) : null}
        <li className="text-caption text-muted-foreground">{copy.floor}</li>
      </ul>
      <div className="flex flex-wrap justify-end gap-4 text-caption">
        <Link href={routes.settings.costs()} className="text-primary hover:underline">
          {copy.setCosts}
        </Link>
        <Link href={routes.settings.expenses()} className="text-primary hover:underline">
          {copy.manageExpenses}
        </Link>
      </div>
    </DataCard>
  )
}
