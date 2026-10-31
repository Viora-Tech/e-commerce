import type { AnalyticsOverview } from '@commerce/api'
import { Card } from '@commerce/ui/shadcn/card'
import { formatPaiseWhole } from '@/lib/money'

type SalesBreakdownCardProps = {
  copy: {
    title: string
    previous: string
    current: string
    lines: Record<AnalyticsOverview['salesBreakdown']['current'][number]['key'], string>
  }
  breakdown: AnalyticsOverview['salesBreakdown']
}

/** Whole rupees like the tiles; anything that rounds to nothing reads ₹0, never -₹0 (audit #50). */
function money(paise: number): string {
  return formatPaiseWhole(Math.round(paise / 100) === 0 ? 0 : paise)
}

/** Gross → discounts → returns → net → shipping → total, with the period before (audit #100). */
export default function SalesBreakdownCard({ copy, breakdown }: SalesBreakdownCardProps) {
  // Render logic
  const before = new Map(breakdown.previous.map((l) => [l.key, l.paise]))

  return (
    <Card gap="none" inset={5}>
      <p className="text-kit-title text-foreground">{copy.title}</p>
      {/* Compact: the figures sit by their labels, both columns headed (audit #49). */}
      <table className="mt-5 w-full max-w-2xl text-kit-body tabular-nums">
        <thead>
          <tr className="text-kit-mini text-muted-foreground">
            <th className="pb-2 text-left font-normal">
              <span className="sr-only">{copy.title}</span>
            </th>
            <th className="w-36 pb-2 text-right font-normal">{copy.previous}</th>
            <th className="w-36 pb-2 text-right font-normal">{copy.current}</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.current.map((line) => (
            <tr
              key={line.key}
              className={line.subtotal ? 'border-t border-border font-medium text-foreground' : ''}
            >
              <td className={`py-2 ${line.key === 'tax' ? 'text-muted-foreground' : ''}`}>
                {copy.lines[line.key]}
              </td>
              <td className="py-2 text-right text-muted-foreground">
                {money(before.get(line.key) ?? 0)}
              </td>
              <td className="py-2 text-right">{money(line.paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
