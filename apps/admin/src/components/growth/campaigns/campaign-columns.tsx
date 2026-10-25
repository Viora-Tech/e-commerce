import type { CampaignPerformanceRow } from '@commerce/api'
import RelativeTime from '@/components/layout/relative-time'
import OrderChip from '@/components/orders/order-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { growthCampaignTabsContent } from '@/data/growth-home'
import { campaignReportContent, type campaignsContent } from '@/data/marketing-campaigns'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'

export type CampaignRow = Awaited<ReturnType<typeof api.marketing.campaigns.list>>[number]

type Copy = typeof campaignsContent

function when(c: CampaignRow): Date | string | null {
  return c.finishedAt ?? c.startedAt ?? c.scheduledAt
}

const dash = '—'

/** Columns of the campaign list (Figma "Marketing / Campaigns list"). */
export function campaignColumns(
  copy: Copy,
  fmt: Formatters,
  ytd?: { rows: Map<string, CampaignPerformanceRow>; copy: typeof growthCampaignTabsContent },
): ResourceColumnSpec<CampaignRow>[] {
  const rate = campaignReportContent.rate
  const year = (c: CampaignRow) => ytd?.rows.get(c.id)
  const ytdColumns: ResourceColumnSpec<CampaignRow>[] = ytd
    ? [
        {
          id: 'sessions-ytd',
          title: ytd.copy.columns.sessions,
          align: 'end',
          sortValue: (c) => year(c)?.sessions ?? 0,
          render: (c) => {
            const n = year(c)?.sessions ?? 0
            return <span className="tabular-nums">{n ? fmt.number(n) : dash}</span>
          },
        },
        {
          id: 'sales-ytd',
          title: ytd.copy.columns.sales,
          align: 'end',
          sortValue: (c) => year(c)?.salesPaise ?? 0,
          render: (c) => {
            const n = year(c)?.salesPaise ?? 0
            return <span className="tabular-nums">{n ? fmt.money(n) : dash}</span>
          },
        },
      ]
    : []
  return [
    {
      id: 'name',
      title: copy.columns.name,
      hideable: false,
      align: 'start',
      className: 'w-80 px-3 whitespace-normal',
      sortValue: (c) => c.name,
      render: (c) => (
        <span className="flex flex-col text-left">
          <span className="text-body-strong">{c.name}</span>
          <span className="text-caption text-muted-foreground">
            {copy.kind[c.kind]} · {c.segmentName ?? copy.allSubscribers}
          </span>
        </span>
      ),
    },
    {
      id: 'sent',
      title: copy.columns.sent,
      align: 'end',
      sortValue: (c) => c.stats.sent,
      render: (c) => (
        <span className="tabular-nums">{c.stats.sent ? fmt.number(c.stats.sent) : dash}</span>
      ),
    },
    {
      id: 'open',
      title: copy.columns.openRate,
      align: 'end',
      render: (c) => (
        <span className="tabular-nums">
          {c.kind === 'email' && c.stats.sent ? rate(c.stats.opened, c.stats.sent) : dash}
        </span>
      ),
    },
    {
      id: 'sales',
      title: copy.columns.sales,
      align: 'end',
      sortValue: (c) => c.stats.revenuePaise,
      render: (c) => (
        <span className="tabular-nums">
          {c.stats.revenuePaise ? fmt.money(c.stats.revenuePaise) : dash}
        </span>
      ),
    },
    ...ytdColumns,
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (c) => <OrderChip kind="campaign" value={c.status} />,
    },
    {
      id: 'date',
      title: copy.columns.date,
      align: 'end',
      sortValue: (c) => new Date(c.createdAt).getTime(),
      render: (c) => {
        const at = when(c)
        return at ? <RelativeTime value={at} /> : <span>{copy.notSent}</span>
      },
    },
  ]
}
