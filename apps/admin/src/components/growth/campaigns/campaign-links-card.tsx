'use client'

import type { CampaignReport } from '@commerce/api'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import SimpleTable from '@/components/table/simple-table'
import { campaignPerformanceContent } from '@/data/growth-report'
import { useCopy, useFormat } from '@/hooks/use-copy'

type CampaignLinksCardProps = { links: CampaignReport['links'] }

/**
 * Visits, orders and sales per page the campaign's links opened. Messages record one click
 * each, not which link it was, so the landing page stands in for the link.
 */
export default function CampaignLinksCard({ links }: CampaignLinksCardProps) {
  // Hooks
  const copy = useCopy(campaignPerformanceContent.links)
  const fmt = useFormat()

  // Render logic
  const c = copy.columns

  return (
    <DataCard title={copy.title} subtitle={copy.subtitle} flush={links.length > 0}>
      {links.length === 0 ? (
        <EmptyState variant="inline" body={copy.empty} />
      ) : (
        <SimpleTable
          columns={[
            { key: 'link', label: c.link },
            { key: 'visits', label: c.visits, align: 'end' },
            { key: 'orders', label: c.orders, align: 'end' },
            { key: 'sales', label: c.sales, align: 'end' },
          ]}
        >
          {links.map((l) => (
            <TableRow key={l.path}>
              <TableCell className="max-w-[20rem] truncate font-medium" title={l.path}>
                {l.path}
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmt.number(l.visits)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt.number(l.orders)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt.money(l.salesPaise)}</TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      )}
    </DataCard>
  )
}
