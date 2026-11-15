'use client'

import { siteConfig } from '@commerce/config/site'
import PageHeaderSkeleton from '@/components/layout/page-header-skeleton'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import { entryColumns } from '@/components/metaobjects/entry-columns'
import ResourceTable from '@/components/table/resource-table'
import { entryListContent } from '@/data/metaobjects'
import { useCopy, useFormat } from '@/hooks/use-copy'

/* Edit definition and Add entry. */
const HEADER_ACTIONS = 2

function noop() {}

/**
 * One content type's entries while the route loads: the detail shell with the back link, a
 * bar for the type's name and the real ResourceTable in its loading state with the entry columns.
 */
export default function EntriesSkeleton() {
  // Hooks
  const copy = useCopy(entryListContent)
  const fmt = useFormat()

  // Render logic
  return (
    <ProoflyDetailPage
      header={<PageHeaderSkeleton back actions={HEADER_ACTIONS} />}
      main={
        <ResourceTable
          resourceName={copy.resource}
          columns={entryColumns(copy, fmt)}
          items={[]}
          getId={(e) => e.id}
          href={() => ''}
          bulkActions={() => null}
          loading
          query=""
          onQueryChange={noop}
          page={1}
          perPage={siteConfig.ui.rowsPerPage.default}
          total={0}
          onPageChange={noop}
          onPerPageChange={noop}
        />
      }
    />
  )
}
