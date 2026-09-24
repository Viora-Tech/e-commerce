'use client'

import { Send } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PillTabs from '@/components/layout/pill-tabs'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { campaignReportContent, campaignsContent as copy } from '@/data/marketing-campaigns'
import type { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import CampaignTiles from './campaign-tiles'
import CreateCampaignMenu from './create-campaign-menu'

type Item = Awaited<ReturnType<typeof api.marketing.campaigns.list>>[number]
type Kind = 'email' | 'whatsapp'

type CampaignsPageProps = { campaigns: Item[] }

const PER_PAGE = 25
const number = new Intl.NumberFormat('en-IN')

function when(c: Item): Date | string {
  return c.finishedAt ?? c.startedAt ?? c.scheduledAt ?? c.createdAt
}

const rate = campaignReportContent.rate

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'name',
    title: copy.columns.name,
    hideable: false,
    align: 'start',
    className: 'w-72 px-3 whitespace-normal',
    sortValue: (c) => c.name,
    render: (c) => (
      <span className="flex flex-col text-left">
        <span className="text-body-strong">{c.name}</span>
        <span className="text-caption text-muted-foreground">{copy.kind[c.kind]}</span>
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    render: (c) => <StatusLabel kind="campaign" value={c.status} />,
  },
  {
    id: 'audience',
    title: copy.columns.audience,
    render: (c) => c.segmentName ?? copy.allSubscribers,
  },
  {
    id: 'sent',
    title: copy.columns.sent,
    sortValue: (c) => c.stats.sent,
    render: (c) => <span className="tabular-nums">{number.format(c.stats.sent)}</span>,
  },
  {
    id: 'open',
    title: copy.columns.openRate,
    render: (c) => (
      <span className="tabular-nums">
        {c.kind === 'email' ? rate(c.stats.opened, c.stats.sent) : '-'}
      </span>
    ),
  },
  {
    id: 'click',
    title: copy.columns.clickRate,
    render: (c) => <span className="tabular-nums">{rate(c.stats.clicked, c.stats.sent)}</span>,
  },
  {
    id: 'orders',
    title: copy.columns.orders,
    sortValue: (c) => c.stats.orders,
    render: (c) => <span className="tabular-nums">{number.format(c.stats.orders)}</span>,
  },
  {
    id: 'sales',
    title: copy.columns.sales,
    sortValue: (c) => c.stats.revenuePaise,
    render: (c) => <span className="tabular-nums">{formatPaise(c.stats.revenuePaise)}</span>,
  },
  {
    id: 'date',
    title: copy.columns.date,
    sortValue: (c) => new Date(c.createdAt).getTime(),
    render: (c) => <RelativeTime value={when(c)} />,
  },
]

/** Marketing > Campaigns: tiles, then every email and WhatsApp campaign with its results. */
export default function CampaignsPage({ campaigns }: CampaignsPageProps) {
  // Hooks
  const [kind, setKind] = useState<Kind | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  // Early returns
  if (campaigns.length === 0) {
    return (
      <PageBody className="gap-6">
        <div className="flex h-9 items-center justify-between">
          <h1 className="text-page-title">{copy.title}</h1>
          <CreateCampaignMenu />
        </div>
        <Card className="py-10">
          <EmptyState heading={copy.empty.heading} body={copy.empty.body} icon={Send} />
        </Card>
      </PageBody>
    )
  }

  // Render logic
  const q = query.trim().toLowerCase()
  const filtered = campaigns.filter(
    (c) => (!kind || c.kind === kind) && (!q || c.name.toLowerCase().includes(q)),
  )
  const items = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <PageBody className="gap-6">
      <div className="flex h-9 items-center justify-between">
        <h1 className="text-page-title">{copy.title}</h1>
        <CreateCampaignMenu />
      </div>
      <CampaignTiles campaigns={campaigns} />
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={items}
        getId={(c) => c.id}
        href={(c) => `/marketing/campaigns/${c.id}`}
        query={query}
        onQueryChange={(next) => {
          setQuery(next)
          setPage(1)
        }}
        onClearAll={() => {
          setQuery('')
          setKind(null)
          setPage(1)
        }}
        tabs={
          <PillTabs
            value={kind}
            onChange={(next) => {
              setKind(next)
              setPage(1)
            }}
            tabs={[
              { value: null, label: copy.tabs.all, count: campaigns.length },
              { value: 'email' as const, label: copy.tabs.email },
              { value: 'whatsapp' as const, label: copy.tabs.whatsapp },
            ]}
          />
        }
        page={page}
        perPage={PER_PAGE}
        total={filtered.length}
        onPageChange={setPage}
        selectable={false}
        empty={{ heading: copy.empty.heading }}
      />
    </PageBody>
  )
}
