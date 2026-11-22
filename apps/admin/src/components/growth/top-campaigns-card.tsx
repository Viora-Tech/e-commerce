import type { CampaignRow } from '@commerce/api'
import { formatNumber } from '@commerce/money'
import { TableCell } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import LinkRow from '@/components/table/link-row'
import SimpleTable from '@/components/table/simple-table'
import { growthOverviewContent } from '@/data/growth'
import { useCopy } from '@/hooks/use-copy'
import { formatPaiseWhole } from '@/lib/money'

type TopCampaignsCardProps = { rows: CampaignRow[] }

/** Campaigns ranked by the sales they drove: tagged links, email and WhatsApp sends, automations. */
export default function TopCampaignsCard({ rows }: TopCampaignsCardProps) {
  // Hooks
  const copy = useCopy(growthOverviewContent).campaigns

  // Derived
  function sourceLabel(row: CampaignRow): string {
    if (row.kind !== 'utm') return copy.kinds[row.kind]
    return [row.source, row.medium].filter(Boolean).join(' / ') || '-'
  }

  // Render logic
  const c = copy.columns

  return (
    <DataCard title={copy.title} flush={rows.length > 0}>
      {rows.length === 0 ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : (
        <SimpleTable
          columns={[
            { key: 'campaign', label: c.campaign },
            { key: 'source', label: c.source },
            { key: 'sessions', label: c.sessions, align: 'end' },
            { key: 'orders', label: c.orders, align: 'end' },
            { key: 'sales', label: c.sales, align: 'end' },
          ]}
        >
          {rows.map((row) => (
            <LinkRow href={row.href ?? undefined} key={row.key}>
              <TableCell className="max-w-64 truncate font-medium">
                {row.href ? (
                  <Link href={row.href} className="hover:underline">
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}
              </TableCell>
              <TableCell>
                {row.kind === 'utm' ? (
                  <span className="text-muted-foreground">{sourceLabel(row)}</span>
                ) : (
                  <StatusChip dot={false}>{sourceLabel(row)}</StatusChip>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatNumber(row.sessions)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.orders)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPaiseWhole(row.salesPaise)}
              </TableCell>
            </LinkRow>
          ))}
        </SimpleTable>
      )}
    </DataCard>
  )
}
