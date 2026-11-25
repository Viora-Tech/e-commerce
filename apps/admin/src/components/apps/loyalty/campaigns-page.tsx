'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import CampaignRowActions from '@/components/apps/loyalty/campaign-row-actions'
import CampaignTimeline from '@/components/apps/loyalty/campaign-timeline'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { type CampaignStatus, campaignStatus, multiplierLabel } from '@/lib/loyalty-campaigns'
import { routes } from '@/lib/routes'

type Campaign = Awaited<ReturnType<typeof api.loyalty.campaigns.list>>[number]

const TONE: Record<CampaignStatus, ChipTone> = {
  running: 'success',
  scheduled: 'info',
  ended: 'neutral',
}

const STATUSES: readonly CampaignStatus[] = ['running', 'scheduled', 'ended']

const PER_PAGE = 25

/**
 * Bonus campaigns (Essential Loyalty's layout): "New campaign" in the header, the week strip of
 * what runs when with today's red line, then an All / Running / Scheduled / Ended view and a
 * search above the list (campaign, status, dates, who, bonus).
 */
export default function LoyaltyCampaignsPage() {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()
  const { data, failed, retry } = useLoad(async () => {
    const [campaigns, tiers] = await Promise.all([
      api.loyalty.campaigns.list(),
      api.loyalty.tiers.list(),
    ])
    return { campaigns, tiers }
  }, [])
  const [view, setView] = useState<CampaignStatus | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  // Render logic
  const c = copy.campaigns
  const now = new Date()
  const tierName = new Map((data?.tiers ?? []).map((t) => [t.id, t.name]))
  const newHref = routes.apps.page('loyalty', 'campaigns', 'new')
  const needle = query.trim().toLowerCase()
  const rows = (data?.campaigns ?? []).filter(
    (camp) =>
      (view === null || campaignStatus(camp, now) === view) &&
      (needle === '' || camp.name.toLowerCase().includes(needle)),
  )
  const columns: ResourceColumnSpec<Campaign>[] = [
    {
      id: 'campaign',
      title: c.columns.campaign,
      hideable: false,
      align: 'start',
      render: (camp) => <span className="font-medium">{camp.name}</span>,
    },
    {
      id: 'status',
      title: c.columns.status,
      render: (camp) => {
        const status = campaignStatus(camp, now)
        return <StatusChip tone={TONE[status]}>{c.status[status]}</StatusChip>
      },
    },
    {
      id: 'dates',
      title: c.columns.dates,
      render: (camp) => (
        <span className="text-muted-foreground">
          {c.dates(f.dateTime(camp.startsAt), f.dateTime(camp.endsAt))}
        </span>
      ),
    },
    {
      id: 'who',
      title: c.columns.who,
      render: (camp) =>
        camp.tierIds.length === 0
          ? c.everyone
          : camp.tierIds.map((id) => tierName.get(id) ?? '?').join(', '),
    },
    {
      id: 'bonus',
      title: c.columns.bonus,
      render: (camp) =>
        camp.bonusType === 'multiplier'
          ? c.multiplier(multiplierLabel(camp.multiplierBp))
          : c.fixed(f.number(camp.bonusPoints)),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={c.title}
        summary={c.summary}
        actions={
          <Button nativeButton={false} render={<Link href={newHref} />}>
            {c.add}
          </Button>
        }
      />
      {data ? (
        <CampaignTimeline campaigns={data.campaigns} now={now} />
      ) : failed ? null : (
        <DataCardSkeleton fields={0} lines={3} />
      )}
      <ResourceTable
        resourceName={c.resource}
        columns={columns}
        items={rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)}
        getId={(camp) => camp.id}
        href={(camp) => routes.apps.page('loyalty', 'campaigns', camp.id)}
        selectable={false}
        loading={data === null && !failed}
        error={failed ? { heading: c.loadFailed, onRetry: retry } : undefined}
        query={query}
        onQueryChange={(next) => {
          setQuery(next)
          setPage(1)
        }}
        views={
          <ViewSelect
            value={view}
            label={c.viewLabel}
            onChange={(next) => {
              setView(next)
              setPage(1)
            }}
            options={[
              { value: null, label: c.views.all },
              ...STATUSES.map((s) => ({ value: s, label: c.status[s] ?? s })),
            ]}
          />
        }
        rowActions={(camp) => (
          <CampaignRowActions
            campaign={camp}
            status={campaignStatus(camp, now)}
            onChanged={retry}
          />
        )}
        page={page}
        perPage={PER_PAGE}
        total={rows.length}
        onPageChange={setPage}
        empty={{ heading: c.empty, body: c.emptyBody }}
        noResults={needle !== '' || view !== null ? { heading: c.noResults } : undefined}
      />
    </div>
  )
}
