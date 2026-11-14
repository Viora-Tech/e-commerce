'use client'

import { siteConfig } from '@commerce/config/site'
import { articleColumns } from '@/components/blog/article-columns'
import ListPageSkeleton from '@/components/layout/list-page-skeleton'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { blogListContent } from '@/data/blog'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { blogPostFilterGroups, NO_BLOG_POST_FILTERS } from '@/lib/blog-post-list-filters'

/* Manage blogs and Write post; the list has no stat strip. */
const HEADER_ACTIONS = 2
const NO_FACETS = { blogs: [], tags: [], authors: [] }

function noop() {}

/**
 * Blog posts while the route loads: the real title, two header buttons and the real
 * ResourceTable in its loading state with the post columns, view select and filter button.
 */
export default function BlogPostsSkeleton() {
  // Hooks
  const copy = useCopy(blogListContent)
  const panelCopy = useCopy(filterPanelContent)
  const fmt = useFormat()

  // Render logic
  const table = (
    <ResourceTable
      resourceName={copy.resource}
      columns={articleColumns(copy, fmt)}
      items={[]}
      getId={(a) => a.id}
      href={() => ''}
      rowActions={() => null}
      bulkActions={() => null}
      loading
      query=""
      onQueryChange={noop}
      filterGroups={blogPostFilterGroups(
        NO_BLOG_POST_FILTERS,
        copy.filters,
        panelCopy,
        NO_FACETS,
        noop,
      )}
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
    />
  )

  return <ListPageSkeleton title={copy.heading} actions={HEADER_ACTIONS} tiles={0} table={table} />
}
