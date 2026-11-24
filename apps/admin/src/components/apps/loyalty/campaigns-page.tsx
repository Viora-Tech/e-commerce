'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import CampaignRowActions from '@/components/apps/loyalty/campaign-row-actions'
import CampaignTimeline from '@/components/apps/loyalty/campaign-timeline'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { type CampaignStatus, campaignStatus, multiplierLabel } from '@/lib/loyalty-campaigns'
import { routes } from '@/lib/routes'

const TONE: Record<CampaignStatus, ChipTone> = {
  running: 'success',
  scheduled: 'info',
  ended: 'neutral',
}

/** Bonus campaigns: a week strip of what runs when, then the list with status, who and bonus. */
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

  // Render logic
  const c = copy.campaigns
  const now = new Date()
  const tierName = new Map((data?.tiers ?? []).map((t) => [t.id, t.name]))
  const newHref = routes.apps.page('loyalty', 'campaigns', 'new')
  const add = (
    <Button nativeButton={false} render={<Link href={newHref} />}>
      {c.add}
    </Button>
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={c.title} summary={c.summary} actions={add} />
      {failed ? (
        <LoadFailedState size="page" heading={c.loadFailed} failed={failed} onRetry={retry} />
      ) : !data ? (
        <>
          <DataCardSkeleton fields={0} lines={3} />
          <DataCardSkeleton fields={0} lines={4} />
        </>
      ) : data.campaigns.length === 0 ? (
        <EmptyState variant="page" heading={c.empty} body={c.emptyBody} action={add} />
      ) : (
        <>
          <CampaignTimeline campaigns={data.campaigns} now={now} />
          <DataCard flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD}>{c.columns.campaign}</TableHead>
                  <TableHead className={HEAD}>{c.columns.status}</TableHead>
                  <TableHead className={HEAD}>{c.columns.dates}</TableHead>
                  <TableHead className={HEAD}>{c.columns.who}</TableHead>
                  <TableHead className={HEAD}>{c.columns.bonus}</TableHead>
                  <TableHead className={HEAD} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.campaigns.map((camp) => {
                  const status = campaignStatus(camp, now)
                  const who =
                    camp.tierIds.length === 0
                      ? c.everyone
                      : camp.tierIds.map((id) => tierName.get(id) ?? '?').join(', ')
                  return (
                    <TableRow key={camp.id}>
                      <TableCell className={`${CELL} font-medium`}>
                        <Link
                          href={routes.apps.page('loyalty', 'campaigns', camp.id)}
                          className="underline-offset-4 hover:underline"
                        >
                          {camp.name}
                        </Link>
                      </TableCell>
                      <TableCell className={CELL}>
                        <StatusChip tone={TONE[status]}>{c.status[status]}</StatusChip>
                      </TableCell>
                      <TableCell className={`${CELL} text-muted-foreground`}>
                        {c.dates(f.dateTime(camp.startsAt), f.dateTime(camp.endsAt))}
                      </TableCell>
                      <TableCell className={CELL}>{who}</TableCell>
                      <TableCell className={CELL}>
                        {camp.bonusType === 'multiplier'
                          ? c.multiplier(multiplierLabel(camp.multiplierBp))
                          : c.fixed(f.number(camp.bonusPoints))}
                      </TableCell>
                      <TableCell className={`${CELL} text-right`}>
                        <CampaignRowActions campaign={camp} status={status} onChanged={retry} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </DataCard>
        </>
      )}
    </div>
  )
}
