'use client'

import { siteConfig } from '@commerce/config/site'
import { Send } from '@commerce/ui/icons'
import { Card } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import { campaignsContent } from '@/data/marketing-campaigns'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { campaignColumns } from './campaign-columns'
import CreateCampaignMenu from './create-campaign-menu'

type Item = Awaited<ReturnType<typeof api.marketing.campaigns.list>>[number]
type Tab = 'sent' | 'scheduled' | 'draft'

type CampaignsPageProps = { campaigns: Item[] }

function inStatus(campaigns: Item[], status: Tab): number {
  return campaigns.filter((c) => c.status === status).length
}

/** Growth > Campaigns: every email and WhatsApp campaign with its results, filtered by status. */
export default function CampaignsPage({ campaigns }: CampaignsPageProps) {
  // Hooks
  const copy = useCopy(campaignsContent)
  const fmt = useFormat()
  const [tab, setTab] = useState<Tab | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  // Render logic
  const sentCount = campaigns.filter((c) => c.status === 'sent').length
  const sales = campaigns.reduce((n, c) => n + c.stats.revenuePaise, 0)
  const summary = copy.summary(campaigns.length, sentCount, fmt.money(sales))

  if (campaigns.length === 0) {
    return (
      <ProoflyListPage title={copy.title} actions={<CreateCampaignMenu />}>
        <Card inset="y-10">
          <EmptyState heading={copy.empty.heading} body={copy.empty.body} icon={Send} />
        </Card>
      </ProoflyListPage>
    )
  }

  const q = query.trim().toLowerCase()
  const filtered = campaigns.filter(
    (c) => (!tab || c.status === tab) && (!q || c.name.toLowerCase().includes(q)),
  )
  const items = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <ProoflyListPage title={copy.title} summary={summary} actions={<CreateCampaignMenu />}>
      <ResourceTable
        resourceName={copy.resource}
        columns={campaignColumns(copy, fmt)}
        items={items}
        getId={(c) => c.id}
        href={(c) => routes.growth.campaign(c.id)}
        rowActions={(c) => (
          <RowMenu items={[{ label: copy.row.open, href: routes.growth.campaign(c.id) }]} />
        )}
        query={query}
        onQueryChange={(next) => {
          setQuery(next)
          setPage(1)
        }}
        onClearAll={() => {
          setQuery('')
          setTab(null)
          setPage(1)
        }}
        tabs={
          <PillTabs
            variant="pill"
            value={tab}
            onChange={(next) => {
              setTab(next)
              setPage(1)
            }}
            tabs={[
              { value: null, label: copy.tabs.all, count: campaigns.length },
              { value: 'sent' as const, label: copy.tabs.sent, count: inStatus(campaigns, 'sent') },
              {
                value: 'scheduled' as const,
                label: copy.tabs.scheduled,
                count: inStatus(campaigns, 'scheduled'),
              },
              {
                value: 'draft' as const,
                label: copy.tabs.draft,
                count: inStatus(campaigns, 'draft'),
              },
            ]}
          />
        }
        page={page}
        perPage={perPage}
        onPerPageChange={(next) => {
          setPerPage(next)
          setPage(1)
        }}
        total={filtered.length}
        onPageChange={setPage}
        selectable={false}
        empty={{ heading: copy.empty.heading }}
      />
    </ProoflyListPage>
  )
}
