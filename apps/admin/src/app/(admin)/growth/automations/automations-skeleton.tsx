'use client'

import { siteConfig } from '@commerce/config/site'
import { automationColumns } from '@/components/growth/automations/automation-columns'
import PageBody from '@/components/layout/page-body'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import ResourceTable from '@/components/table/resource-table'
import { automationsContent } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'

/* Browse templates and New automation. */
const HEADER_ACTIONS = 2

function noop() {}

/** Automations while the route loads: the back link, two buttons and the real columns. */
export default function AutomationsSkeleton() {
  // Hooks
  const copy = useCopy(automationsContent)

  // Render logic
  return (
    <PageBody>
      <PageHeaderSkeleton back actions={HEADER_ACTIONS} />
      <ResourceTable
        resourceName={copy.resource}
        columns={automationColumns(copy)}
        items={[]}
        getId={(a) => a.id}
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
        selectable
      />
    </PageBody>
  )
}
