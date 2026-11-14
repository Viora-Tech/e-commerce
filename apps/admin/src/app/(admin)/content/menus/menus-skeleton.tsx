'use client'

import { siteConfig } from '@commerce/config/site'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import { menuColumns } from '@/components/navigation/menu-columns'
import ResourceTable from '@/components/table/resource-table'
import { menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'

/* Header and footer, URL redirects and Create menu. */
const HEADER_ACTIONS = 3

function noop() {}

/** Menus while the route loads: the real title, its buttons and the table with the menu columns. */
export default function MenusSkeleton() {
  // Hooks
  const copy = useCopy(menusContent)

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={menuColumns(copy, () => [])}
      items={[]}
      getId={(m) => m.id}
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
  )

  return <ListPageSkeleton title={copy.title} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
