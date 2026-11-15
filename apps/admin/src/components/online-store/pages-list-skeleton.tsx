'use client'

import { siteConfig } from '@commerce/config/site'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { pagesListContent } from '@/data/content'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { pageColumns } from './page-columns'

function noop() {}

/**
 * Online Store › Pages while its route loads (`pages/loading.tsx`): the real title, Add page,
 * and the real ResourceTable in its loading state with the Pages columns, search and view
 * select, so the header labels and column widths do not move when the pages arrive.
 */
export default function PagesListSkeleton() {
  // Hooks
  const copy = useCopy(pagesListContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={pageColumns(copy, fmt)}
      items={[]}
      getId={(p) => p.id}
      href={() => ''}
      rowActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      views={
        <ViewSelect<null>
          value={null}
          onChange={noop}
          options={[{ value: null, label: copy.tabs.all }]}
          pending
        />
      }
      page={1}
      perPage={siteConfig.ui.rowsPerPage.default}
      total={0}
      onPageChange={noop}
      onPerPageChange={noop}
      selectable={false}
    />
  )

  return <ListPageSkeleton title={copy.title} actions={1} tiles={0} table={table} />
}
