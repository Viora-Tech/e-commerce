'use client'

import { siteConfig } from '@commerce/config/site'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { pagesListContent } from '@/data/content'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CreatePageDialog from './create-page-dialog'
import { type PageItem, pageColumns, pageUrl } from './page-columns'
import PageRowMenu from './page-row-menu'

type PagesListProps = { storefrontOrigin: string }

const TABS = ['live', 'hidden'] as const

function PagesContent({ storefrontOrigin }: PagesListProps) {
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
  const [items, setItems] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)
  /** The last read failed: the table says so (with Try again) instead of "No pages yet". */
  const [failed, setFailed] = useState(false)
  const [creating, setCreating] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (attempt < 0) return
    api.pages
      .list()
      .then(
        (list) => {
          setItems(list)
          setFailed(false)
        },
        () => setFailed(true),
      )
      .finally(() => setLoading(false))
  }, [attempt])

  // Helpers
  /* After a row action: a failed read lands in the table too, not as stale rows. */
  const reload = () => {
    api.pages.list().then(
      (list) => {
        setItems(list)
        setFailed(false)
      },
      () => setFailed(true),
    )
  }

  // Event handlers
  const handleRetry = () => {
    setFailed(false)
    setLoading(true)
    setAttempt((n) => n + 1)
  }

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

  const columns = pageColumns(copy, fmt)

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
        fill
        resourceName={copy.resource}
        columns={columns}
        items={pageRows}
        getId={(p) => p.id}
        href={(p) => routes.onlineStore.page(p.id)}
        rowActions={(p) => (
          <PageRowMenu
            page={p}
            path={pageUrl(p.handle)}
            storefrontOrigin={storefrontOrigin}
            onChanged={reload}
          />
        )}
        loading={loading}
        error={failed ? { heading: copy.loadFailed, onRetry: handleRetry } : undefined}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
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
export default function PagesList({ storefrontOrigin }: PagesListProps) {
  return (
    <Suspense>
      <PagesContent storefrontOrigin={storefrontOrigin} />
    </Suspense>
  )
}
