import type { CampaignRow } from '@commerce/api'
import { formatNumber } from '@commerce/money'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Card } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { growthOverviewContent } from '@/data/growth'
import { formatPaiseWhole } from '@/lib/money'

type TopCampaignsCardProps = { rows: CampaignRow[] }

const copy = growthOverviewContent.campaigns

function sourceLabel(row: CampaignRow): string {
  if (row.kind !== 'utm') return copy.kinds[row.kind]
  return [row.source, row.medium].filter(Boolean).join(' / ') || '-'
}

/** Campaigns ranked by the sales they drove: tagged links, email and WhatsApp sends, automations. */
export default function TopCampaignsCard({ rows }: TopCampaignsCardProps) {
  // Render logic
  const c = copy.columns

  return (
    <Card gap="none" inset={5}>
      <p className="text-kit-title text-foreground">{copy.title}</p>
      {rows.length === 0 ? (
        <p className="mt-5 text-kit-body text-muted-foreground">{copy.empty}</p>
      ) : (
        <Table className="mt-3">
          <TableHeader>
            <TableRow>
              <TableHead>{c.campaign}</TableHead>
              <TableHead>{c.source}</TableHead>
              <TableHead className="text-right">{c.sessions}</TableHead>
              <TableHead className="text-right">{c.orders}</TableHead>
              <TableHead className="text-right">{c.sales}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
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
                    <Badge variant="secondary">{sourceLabel(row)}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.sessions)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(row.orders)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPaiseWhole(row.salesPaise)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}
