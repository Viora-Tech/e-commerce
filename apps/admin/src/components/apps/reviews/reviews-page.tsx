'use client'

import { siteConfig } from '@commerce/config/site'
import { CircleCheck, EyeOff, MessageSquare, Settings, Trash2, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { appliedFromGroups } from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { filterPanelContent } from '@/data/filter-panel'
import { reviewToolsContent } from '@/data/review-tools'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  CLEAR_REVIEW_FILTERS,
  REVIEW_FILTER_PARAMS,
  reviewFilterGroups,
  reviewFilterInput,
} from '@/lib/review-list-filters'
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
  const toolsCopy = useCopy(reviewToolsContent)
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      status: parseAsStringLiteral(STATUSES),
      ...REVIEW_FILTER_PARAMS,
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
        ...reviewFilterInput(q),
      })
      .then((r) => !cancelled && setResult(r))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : copy.list.failed))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, perPage, version, copy.list.failed])
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
  const groups = reviewFilterGroups(q, copy.list.filters, panelCopy, products, (patch) =>
    setQ({ ...patch, page: 1 }),
  )
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
              <Upload aria-hidden="true" />
              {copy.list.importJudgeme}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.page('reviews', 'questions')} />}
            >
              <MessageSquare aria-hidden="true" />
              {toolsCopy.questions.open}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.apps.page('reviews', 'settings')} />}
            >
              <Settings aria-hidden="true" />
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
        onClearAll={() => setQ({ ...CLEAR_REVIEW_FILTERS, query: '', status: null, page: 1 })}
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
        filterGroups={groups}
        page={q.page}
        perPage={perPage}
        onPerPageChange={(next) => {
          setPerPage(next)
          setQ({ page: 1 })
        }}
        total={result?.total ?? 0}
        onPageChange={(page) => setQ({ page })}
        bulkActions={(ids, clear) => (
          <>
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
          </>
        )}
        rowActions={(r) => (
          <ReviewRowActions id={r.id} status={r.status} featured={r.featured} onChanged={reload} />
        )}
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
