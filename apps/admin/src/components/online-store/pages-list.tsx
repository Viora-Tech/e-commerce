'use client'

import { siteConfig } from '@commerce/config/site'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { pagesListContent } from '@/data/content'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CreatePageDialog from './create-page-dialog'

type Item = Awaited<ReturnType<typeof api.pages.list>>[number]

const TABS = ['live', 'hidden'] as const

const pageUrl = (handle: string) => (handle === 'home' ? '/' : `/pages/${handle}`)

/** "landing-page" becomes "Landing page"; no suffix is the theme's default template. */
const templateName = (suffix: string | null, fallback: string) => {
  if (!suffix) return fallback
  const words = suffix.replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function PagesContent() {
  // Hooks
  const copy = useCopy(pagesListContent)
  const fmt = useFormat()
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      tab: parseAsStringLiteral(TABS),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
    },
    { shallow: true },
  )
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  useEffect(() => {
    api.pages
      .list()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  // Render logic
  const live = items.filter((p) => p.publishedAt).length
  const hidden = items.length - live
  const needle = q.query.trim().toLowerCase()
  const matching = items.filter(
    (p) =>
      (q.tab === null || (q.tab === 'live') === Boolean(p.publishedAt)) &&
      (needle === '' || p.title.toLowerCase().includes(needle) || p.handle.includes(needle)),
  )
  const pageRows = matching.slice((q.page - 1) * q.perPage, q.page * q.perPage)

  const columns: ResourceColumnSpec<Item>[] = [
    {
      id: 'title',
      title: copy.columns.title,
      sortValue: (p) => p.title,
      hideable: false,
      render: (p) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-ink-strong">{p.title}</span>
          <span className="truncate text-caption text-muted-foreground">{pageUrl(p.handle)}</span>
        </span>
      ),
    },
    {
      id: 'template',
      title: copy.columns.template,
      sortValue: (p) => p.templateSuffix ?? '',
      render: (p) => templateName(p.templateSuffix, copy.template.default),
    },
    {
      id: 'visibility',
      title: copy.columns.visibility,
      sortValue: (p) => (p.publishedAt ? 1 : 0),
      render: (p) => (
        <StatusChip tone={p.publishedAt ? 'success' : 'neutral'}>
          {p.publishedAt ? copy.visibility.live : copy.visibility.hidden}
        </StatusChip>
      ),
    },
    {
      id: 'updated',
      title: copy.columns.updated,
      sortValue: (p) => new Date(p.updatedAt),
      render: (p) => <span title={fmt.dateTime(p.updatedAt)}>{fmt.when(p.updatedAt)}</span>,
    },
  ]

  const addButton = (
    <Button type="button" onClick={() => setCreating(true)}>
      <Plus strokeWidth={1.6} />
      {copy.add}
    </Button>
  )

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(items.length, live, hidden)}
      actions={addButton}
    >
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={pageRows}
        getId={(p) => p.id}
        href={(p) => routes.onlineStore.page(p.id)}
        rowActions={(p) => (
          <RowMenu items={[{ label: copy.open, href: routes.onlineStore.page(p.id) }]} />
        )}
        loading={loading}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', tab: null, page: 1 })}
        views={
          <ViewSelect
            value={q.tab}
            onChange={(tab) => setQ({ tab, page: 1 })}
            options={[
              { value: null, label: copy.tabs.all, count: items.length },
              { value: 'live', label: copy.tabs.live, count: live },
              { value: 'hidden', label: copy.tabs.hidden, count: hidden },
            ]}
          />
        }
        page={q.page}
        perPage={q.perPage}
        total={matching.length}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
        selectable={false}
        empty={
          items.length === 0
            ? { heading: copy.empty.heading, body: copy.empty.body, action: addButton }
            : { heading: copy.noMatch.heading, body: copy.noMatch.body }
        }
      />
      <CreatePageDialog open={creating} onOpenChange={setCreating} />
    </ProoflyListPage>
  )
}

/** Content › Pages: every page, published or hidden. */
export default function PagesList() {
  return (
    <Suspense>
      <PagesContent />
    </Suspense>
  )
}
