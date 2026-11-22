'use client'

import { siteConfig } from '@commerce/config/site'
import { campaignColumns } from '@/components/growth/campaigns/campaign-columns'
import CampaignsTabs from '@/components/growth/campaigns/campaigns-tabs'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import ResourceTable from '@/components/table/resource-table'
import { campaignReportContent, campaignsContent } from '@/data/marketing-campaigns'
import { useCopy, useFormat } from '@/hooks/use-copy'

/* Automations and Create campaign. */
const HEADER_ACTIONS = 2

function noop() {}

/**
 * Campaigns while the route loads: the back link, the header's two buttons, the Campaigns |
 * Tracking links tabs and the table with the real campaign columns.
 */
export default function CampaignsSkeleton() {
  // Hooks
  const copy = useCopy(campaignsContent)
  const reportCopy = useCopy(campaignReportContent)
  const fmt = useFormat()

  // Render logic
  return (
    <PageBody>
      <PageHeaderSkeleton back actions={HEADER_ACTIONS} />
      <CampaignsTabs value="campaigns" />
      <ResourceTable
        resourceName={copy.resource}
        columns={campaignColumns(copy, fmt, reportCopy.rate)}
        items={[]}
        getId={(c) => c.id}
        href={() => ''}
        rowActions={() => null}
        loading
        query=""
        onQueryChange={noop}
        page={1}
        perPage={siteConfig.ui.rowsPerPage.default}
        total={0}
        onPageChange={noop}
        onPerPageChange={noop}
        selectable={false}
      />
    </PageBody>
  )
}
