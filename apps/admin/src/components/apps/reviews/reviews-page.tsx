'use client'

import { siteConfig } from '@commerce/config/site'
import { CircleCheck, EyeOff, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  type FilterGroup,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import AskReviewsButton from './ask-reviews-button'
import DeleteReviewsDialog from './delete-reviews-dialog'
import { reviewColumns } from './review-columns'
import ReviewRowActions from './review-row-actions'
import ReviewTiles from './review-tiles'

type ListResult = Awaited<ReturnType<typeof api.reviews.list>>
type Products = Awaited<ReturnType<typeof api.reviews.products>>

const STATUSES = ['pending', 'published', 'hidden'] as const

/** Apps, Reviews: tiles, status tabs, search and filters over every review, bulk approve or hide. */
export default function ReviewsPage() {
  return (
    <Suspense>
      <ReviewsList />
    </Suspense>
  )
}

function ReviewsList() {
  // Hooks
  const copy = useCopy(reviewsContent)
  const panelCopy = useCopy(filterPanelContent)
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(STATUSES),
      rating: parseAsInteger,
      product: parseAsString,
      photos: parseAsStringLiteral(['yes', 'no'] as const),
    },
    { shallow: true },
  )
  const [result, setResult] = useState<ListResult | null>(null)
  const [products, setProducts] = useState<Products>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [deleting, setDeleting] = useState<{ ids: string[]; clear: () => void } | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.reviews
      .list({
        page: q.page,
        perPage,
        q: q.query || undefined,
        status: q.status ?? undefined,
        rating: q.rating ?? undefined,
        productId: q.product ?? undefined,
        hasPhotos: q.photos === null ? undefined : q.photos === 'yes',
      })
      .then((r) => !cancelled && setResult(r))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : copy.list.failed))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q.page, q.query, q.status, q.rating, q.product, q.photos, perPage, version, copy.list.failed])
  useEffect(() => {
    api.reviews
      .products()
      .then(setProducts)
      .catch(() => undefined)
  }, [])

  // Helpers
  const reload = () => setVersion((v) => v + 1)
  const runBulk = async (ids: string[], clear: () => void, status: 'published' | 'hidden') => {
    setBusy(true)
    try {
      const { updated } = await api.reviews.setStatus({ ids, status })
      toast.success(
        status === 'published' ? copy.list.bulk.approved(updated) : copy.list.bulk.hidden(updated),
      )
      clear()
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.list.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const stats = result?.stats ?? {
    all: 0,
    pending: 0,
    published: 0,
    hidden: 0,
    average: null,
    withPhotos: 0,
  }
  const f = copy.list.filters
  const groups: FilterGroup[] = [
    {
      key: 'rating',
      label: f.rating,
      type: 'select',
      options: [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: f.ratingValue(n) })),
      value: q.rating ? String(q.rating) : null,
      onChange: (next) => setQ({ rating: next ? Number(next) : null, page: 1 }),
      anyLabel: f.any,
    },
    {
      key: 'product',
      label: f.product,
      type: 'select',
      options: products.map((p) => ({ value: p.id, label: p.title })),
      value: q.product,
      onChange: (product) => setQ({ product, page: 1 }),
      anyLabel: f.any,
    },
    {
      key: 'photos',
      label: f.photos,
      type: 'select',
      options: [
        { value: 'yes', label: f.yes },
        { value: 'no', label: f.no },
      ],
      value: q.photos,
      onChange: (next) => setQ({ photos: next === 'yes' || next === 'no' ? next : null, page: 1 }),
      anyLabel: f.any,
    },
  ]
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || q.query !== '' || q.status !== null

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.list.title}
        subtitle={copy.list.subtitle}
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.page('reviews', 'import')} />}
            >
              {copy.list.importJudgeme}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.page('reviews', 'settings')} />}
            >
              {copy.list.settings}
            </Button>
            <AskReviewsButton />
          </>
        }
      />
      {result ? (
        <ReviewTiles
          stats={stats}
          status={q.status}
          onStatus={(status) => setQ({ status, page: 1 })}
        />
      ) : (
        <div className="h-[6.5rem]" />
      )}
      <ResourceTable
        resourceName={copy.list.resource}
        columns={reviewColumns(copy)}
        items={result?.rows ?? []}
        getId={(r) => r.id}
        href={(r) => routes.apps.page('reviews', 'reviews', r.id)}
        loading={loading && !result}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() =>
          setQ({ query: '', status: null, rating: null, product: null, photos: null, page: 1 })
        }
        views={
          <ViewSelect
            value={q.status}
            onChange={(status) => setQ({ status, page: 1 })}
            options={[
              { value: null, label: copy.list.tabs.all, count: stats.all },
              ...STATUSES.map((s) => ({ value: s, label: copy.list.tabs[s], count: stats[s] })),
            ]}
          />
        }
        filters={(close) => (
          <FilterPanel
            groups={groups}
            onClear={() => clearGroups(groups)}
            footer={{ label: panelCopy.show(result?.total ?? 0), onDone: close }}
          />
        )}
        filtersClassName={FILTER_PANEL_CLASS}
        applied={applied}
        page={q.page}
        perPage={perPage}
        onPerPageChange={(next) => {
          setPerPage(next)
          setQ({ page: 1 })
        }}
        total={result?.total ?? 0}
        onPageChange={(page) => setQ({ page })}
        bulkActions={(ids, clear) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => runBulk(ids, clear, 'published')}
            >
              <CircleCheck />
              {copy.list.bulk.approve}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => runBulk(ids, clear, 'hidden')}
            >
              <EyeOff />
              {copy.list.bulk.hide}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              disabled={busy}
              onClick={() => setDeleting({ ids, clear })}
            >
              <Trash2 />
              {copy.list.bulk.delete}
            </Button>
          </div>
        )}
        rowActions={(r) => <ReviewRowActions id={r.id} status={r.status} onChanged={reload} />}
        empty={filtered ? copy.list.emptyFiltered : copy.list.empty}
      />
      <DeleteReviewsDialog
        ids={deleting?.ids ?? []}
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => {
          deleting?.clear()
          reload()
        }}
      />
    </div>
  )
}
