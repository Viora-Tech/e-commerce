'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import PageBody from '@/components/layout/page-body'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { onlineStoreContent } from '@/data/online-store'
import { api } from '@/lib/api-client'
import CreatePageDialog from './create-page-dialog'

type Item = Awaited<ReturnType<typeof api.pages.list>>[number]

const copy = onlineStoreContent.pages

const pageUrl = (handle: string) => (handle === 'home' ? '/' : `/pages/${handle}`)

const columns: ResourceColumnSpec<Item>[] = [
  {
    id: 'title',
    title: copy.columns.title,
    sortValue: (p) => p.title,
    hideable: false,
    render: (p) => <span className="font-bold text-ink-strong">{p.title}</span>,
  },
  {
    id: 'url',
    title: copy.columns.url,
    sortValue: (p) => p.handle,
    render: (p) => <span className="text-muted-foreground">{pageUrl(p.handle)}</span>,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (p) => (p.publishedAt ? 1 : 0),
    render: (p) =>
      p.publishedAt ? (
        <StatusLabel kind="page" value="published" size="sm" />
      ) : (
        <StatusLabel kind="page" value="draft" size="sm" />
      ),
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (p) => new Date(p.updatedAt),
    align: 'end',
    render: (p) => <RelativeTime value={p.updatedAt} className="text-muted-foreground" />,
  },
]

/** Online Store › Pages: every Puck page, published or draft. */
export default function PagesList() {
  // Hooks
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    api.pages
      .list()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  // Render logic
  const shown = items.filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <PageBody>
      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus />
          {copy.add}
        </Button>
      </div>
      <ResourceTable
        resourceName={{ singular: 'page', plural: 'pages' }}
        columns={columns}
        items={shown}
        getId={(p) => p.id}
        href={(p) => `/online-store/pages/${p.id}`}
        loading={loading}
        query={query}
        onQueryChange={setQuery}
        page={1}
        perPage={100}
        total={shown.length}
        onPageChange={() => {}}
        selectable={false}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus />
              {copy.add}
            </Button>
          ),
        }}
      />
      <CreatePageDialog open={creating} onOpenChange={setCreating} />
    </PageBody>
  )
}
