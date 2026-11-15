'use client'

import type { CampaignPerformanceRow } from '@commerce/api'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { TableCell } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import LinkRow from '@/components/table/link-row'
import SimpleTable from '@/components/table/simple-table'
import { growthHomeContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import MetricLabel from '../metric-label'

type RecentCampaignsCardProps = { rows: CampaignPerformanceRow[] }

const SHOWN = 5
const dash = '—'

/** Shopify's "Recent campaigns": the latest campaigns with this year's sessions and sales. */
export default function RecentCampaignsCard({ rows }: RecentCampaignsCardProps) {
  // Hooks
  const copy = useCopy(growthHomeContent.recent)
  const fmt = useFormat()

  // Render logic
  const c = copy.columns
  const shown = rows.slice(0, SHOWN)
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-body-strong text-foreground">{copy.title}</h2>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={routes.growth.automations()} />}
          nativeButton={false}
        >
          {copy.automations}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={routes.growth.campaigns()} />}
          nativeButton={false}
        >
          {copy.viewAll}
        </Button>
      </div>
    </div>
  )

  return (
    <section className="flex flex-col gap-3">
      {header}
      <Card inset="none" gap="none">
        {shown.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <EmptyState variant="inline" body={copy.empty} />
            <Button
              variant="outline"
              render={<Link href={routes.growth.newCampaign()} />}
              nativeButton={false}
            >
              {copy.create}
            </Button>
          </div>
        ) : (
          <SimpleTable
            className="min-w-[36rem]"
            columns={[
              { key: 'campaign', label: c.campaign },
              { key: 'updated', label: c.updated },
              { key: 'created', label: c.created },
              {
                key: 'sessions',
                label: <MetricLabel help={copy.help.sessions}>{c.sessions}</MetricLabel>,
                align: 'end',
              },
              {
                key: 'sales',
                label: <MetricLabel help={copy.help.sales}>{c.sales}</MetricLabel>,
                align: 'end',
              },
            ]}
          >
            {shown.map((r) => (
              <LinkRow href={r.id ? routes.growth.campaign(r.id) : undefined} key={r.key}>
                <TableCell className="text-body-strong">
                  {r.id ? (
                    <Link href={routes.growth.campaign(r.id)} className="hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </TableCell>
                <TableCell>{fmt.date(r.updatedAt)}</TableCell>
                <TableCell>{fmt.date(r.createdAt)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.sessions ? fmt.number(r.sessions) : dash}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.salesPaise ? fmt.moneyWhole(r.salesPaise) : dash}
                </TableCell>
              </LinkRow>
            ))}
          </SimpleTable>
        )}
      </Card>
    </section>
  )
}
