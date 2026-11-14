import type { AnalyticsOverview } from '@commerce/api'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import SimpleTable from '@/components/table/simple-table'
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
    <DataCard title={copy.title}>
      {/* Compact: the figures sit by their labels, both columns headed (audit #49). */}
      <SimpleTable
        density="compact"
        className="max-w-2xl tabular-nums"
        columns={[
          { key: 'line', label: <span className="sr-only">{copy.title}</span> },
          { key: 'previous', label: copy.previous, align: 'end', className: 'w-36' },
          { key: 'current', label: copy.current, align: 'end', className: 'w-36' },
        ]}
      >
        {breakdown.current.map((line) => (
          <TableRow
            key={line.key}
            className={line.subtotal ? 'font-medium text-foreground' : undefined}
          >
            <TableCell className={line.key === 'tax' ? 'text-muted-foreground' : undefined}>
              {copy.lines[line.key]}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {money(before.get(line.key) ?? 0)}
            </TableCell>
            <TableCell className="text-right">{money(line.paise)}</TableCell>
          </TableRow>
        ))}
      </SimpleTable>
    </DataCard>
  )
}
