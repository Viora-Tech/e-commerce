'use client'

import { siteConfig } from '@commerce/config/site'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import { definitionColumns } from '@/components/metaobjects/definition-columns'
import ResourceTable from '@/components/table/resource-table'
import { metaobjectListContent } from '@/data/metaobjects'
import { useCopy, useFormat } from '@/hooks/use-copy'

/* From a template and Add content type. */
const HEADER_ACTIONS = 2

function noop() {}

/** Content types while the route loads: the real title, two buttons and the real columns. */
export default function DefinitionsSkeleton() {
  // Hooks
  const copy = useCopy(metaobjectListContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={definitionColumns(copy, fmt)}
      items={[]}
      getId={(d) => d.id}
      href={() => ''}
      selectable={false}
      loading
      query=""
      onQueryChange={noop}
      page={1}
      perPage={siteConfig.ui.rowsPerPage.default}
      total={0}
      onPageChange={noop}
      onPerPageChange={noop}
    />
  )

  return <ListPageSkeleton title={copy.heading} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
