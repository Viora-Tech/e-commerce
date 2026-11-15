'use client'

import { siteConfig } from '@commerce/config/site'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import { redirectColumns } from '@/components/redirects/redirect-columns'
import ResourceTable from '@/components/table/resource-table'
import { redirectsContent } from '@/data/redirects'
import { useCopy, useFormat } from '@/hooks/use-copy'

/* Export, Import and Add redirect. */
const HEADER_ACTIONS = 3

function noop() {}

/**
 * URL redirects while the route loads: the detail shell with the back link, the real title and
 * its three buttons, then the real ResourceTable in its loading state with the redirect columns.
 */
export default function RedirectsSkeleton() {
  // Hooks
  const copy = useCopy(redirectsContent)
  const fmt = useFormat()

  // Render logic
  return (
    <ProoflyDetailPage
      header={<PageHeaderSkeleton title={copy.title} back actions={HEADER_ACTIONS} />}
      main={
        <ResourceTable
          resourceName={copy.resource}
          columns={redirectColumns(copy, fmt)}
          items={[]}
          getId={(r) => r.id}
          rowActions={() => null}
          bulkActions={() => null}
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
      }
    />
  )
}
