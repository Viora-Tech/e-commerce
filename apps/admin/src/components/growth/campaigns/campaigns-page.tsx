'use client'

import type { CampaignPerformanceRow } from '@commerce/api'
import { siteConfig } from '@commerce/config/site'
import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { type ReactNode, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { growthCampaignTabsContent } from '@/data/growth-home'
import { campaignsContent } from '@/data/marketing-campaigns'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { campaignColumns } from './campaign-columns'
import CampaignRowMenu from './campaign-row-menu'
import CreateCampaignMenu from './create-campaign-menu'
import TrackedCampaignsCard from './tracked-campaigns-card'

type Item = Awaited<ReturnType<typeof api.marketing.campaigns.list>>[number]
type Tab = 'sent' | 'scheduled' | 'draft'

type CampaignsPageProps = {
  campaigns: Item[]
  /** Sessions and sales since 1 January for our sends and tracking-link campaigns. */
  performance: CampaignPerformanceRow[]
  /** Campaigns | Tracking links, under the header. */
  tabs?: ReactNode
}

function inStatus(campaigns: Item[], status: Tab): number {
  return campaigns.filter((c) => c.status === status).length
}

/**
 * Growth > Campaigns: every email and WhatsApp campaign with its results and this year's
 * sessions and sales, filtered by status, then the campaigns found on tracking links.
 */
export default function CampaignsPage({ campaigns, performance, tabs }: CampaignsPageProps) {
  // Hooks
  const copy = useCopy(campaignsContent)
  const tabsCopy = useCopy(growthCampaignTabsContent)
  const fmt = useFormat()
  const [tab, setTab] = useState<Tab | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  // Render logic
  const sentCount = campaigns.filter((c) => c.status === 'sent').length
  const sales = campaigns.reduce((n, c) => n + c.stats.revenuePaise, 0)
  const back = { label: copy.back, href: routes.growth.home() }
  const summary = copy.summary(campaigns.length, sentCount, fmt.money(sales))
  const ytd = new Map(performance.flatMap((r) => (r.id ? [[r.id, r] as const] : [])))
  const tracked = performance.filter((r) => r.kind === 'utm')
  const actions = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        render={<Link href={routes.growth.automations()} />}
        nativeButton={false}
      >
        {tabsCopy.automations}
      </Button>
      <CreateCampaignMenu />
    </div>
  )

  if (campaigns.length === 0) {
    return (
      <ProoflyListPage
        title={copy.title}
        summary={copy.summaryEmpty}
        back={back}
        actions={actions}
        controls={tabs}
      >
        <Card inset="y-10">
          <EmptyState
            heading={copy.empty.heading}
            body={copy.empty.body}
            icon={Send}
            action={<CreateCampaignMenu />}
          />
        </Card>
        <TrackedCampaignsCard rows={tracked} />
      </ProoflyListPage>
    )
  }

  const q = query.trim().toLowerCase()
  const filtered = campaigns.filter(
    (c) => (!tab || c.status === tab) && (!q || c.name.toLowerCase().includes(q)),
  )
  const items = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <ProoflyListPage
      title={copy.title}
      summary={summary}
      back={back}
      actions={actions}
      controls={tabs}
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={campaignColumns(copy, fmt, { rows: ytd, copy: tabsCopy })}
        items={items}
        getId={(c) => c.id}
        href={(c) => routes.growth.campaign(c.id)}
        rowActions={(c) => <CampaignRowMenu campaign={c} />}
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
        views={
          <ViewSelect
            value={tab}
            onChange={(next) => {
              setTab(next)
              setPage(1)
            }}
            options={[
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
      <TrackedCampaignsCard rows={tracked} />
    </ProoflyListPage>
  )
}
