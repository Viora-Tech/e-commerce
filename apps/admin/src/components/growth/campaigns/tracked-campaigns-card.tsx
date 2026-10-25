'use client'

import type { CampaignPerformanceRow } from '@commerce/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import DataCard from '@/components/layout/data-card'
import { growthCampaignTabsContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'

type TrackedCampaignsCardProps = { rows: CampaignPerformanceRow[] }

/** Campaign names found on tracking links and tagged visits (utm_campaign), with this year's results. */
export default function TrackedCampaignsCard({ rows }: TrackedCampaignsCardProps) {
  // Hooks
  const copy = useCopy(growthCampaignTabsContent.tracked)
  const fmt = useFormat()

  // Early returns
  if (rows.length === 0) return null

  // Render logic
  const c = copy.columns

  return (
    <DataCard title={copy.title} subtitle={copy.subtitle} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{c.campaign}</TableHead>
            <TableHead className="text-right">{c.links}</TableHead>
            <TableHead className="text-right">{c.sessions}</TableHead>
            <TableHead className="text-right">{c.orders}</TableHead>
            <TableHead className="text-right">{c.sales}</TableHead>
            <TableHead className="text-right">{c.updated}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="text-body-strong">{r.name}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt.number(r.links)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt.number(r.sessions)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt.number(r.orders)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt.money(r.salesPaise)}</TableCell>
              <TableCell className="text-right">{fmt.date(r.updatedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}
