'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageBody } from '@/components/layout/page-body'
import { StatusPill } from '@/components/layout/status-pill'
import { type ResourceColumnSpec, ResourceTable } from '@/components/table/resource-table'
import { onlineStoreContent } from '@/data/online-store'
import { api } from '@/lib/api-client'
import { CreatePageDialog } from './create-page-dialog'

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
        <StatusPill tone="success">{copy.status.published}</StatusPill>
      ) : (
        <StatusPill tone="info">{copy.status.draft}</StatusPill>
      ),
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (p) => new Date(p.updatedAt),
    align: 'end',
    render: (p) => (
      <span className="text-muted-foreground tabular-nums">
        {new Date(p.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
      </span>
    ),
  },
]

/** Online Store › Pages: every Puck page, published or draft. */
export function PagesList() {
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
