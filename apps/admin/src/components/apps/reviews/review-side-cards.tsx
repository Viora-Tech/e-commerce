'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import ProductThumb from '@/components/products/product-thumb'
import { reviewsContent } from '@/data/reviews'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DeleteReviewsDialog from './delete-reviews-dialog'
import ReviewStars from './review-stars'

type Detail = Awaited<ReturnType<typeof api.reviews.get>>

type ReviewSideCardsProps = {
  detail: Detail
  onChanged: () => void
  onDeleted: () => void
}

/** Right column of a review: its product, the customer, the store switches and Delete. */
export default function ReviewSideCards({ detail, onChanged, onDeleted }: ReviewSideCardsProps) {
  // Hooks
  const all = useCopy(reviewsContent)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await work()
      toast.success(all.detail.saved)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : all.list.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleShow = (on: boolean) =>
    run(() =>
      api.reviews.setStatus({ ids: [detail.review.id], status: on ? 'published' : 'hidden' }),
    )
  const handleFeature = (on: boolean) =>
    run(() => api.reviews.setFeatured({ id: detail.review.id, featured: on }))

  // Render logic
  const copy = all.detail
  const p = detail.product
  const c = detail.customer
  const rows: [string, string][] = [
    [copy.customer.name, c.name],
    [copy.customer.orders, String(c.orders)],
    [copy.customer.reviews, String(c.reviews)],
  ]

  return (
    <>
      {p ? (
        <DataCard title={copy.product.title}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <ProductThumb url={p.image} className="size-10" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-body">{p.title}</span>
                <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <ReviewStars value={p.rating} label={all.stars(p.rating)} />
                  {p.count > 0 ? `${p.rating.toFixed(1)} · ` : ''}
                  {copy.product.reviews(p.count)}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              nativeButton={false}
              render={<Link href={routes.products.detail(p.id)} />}
            >
              {copy.product.view}
            </Button>
          </div>
        </DataCard>
      ) : null}
      <DataCard title={copy.customer.title}>
        <dl className="flex flex-col gap-2 text-body">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="truncate">{v}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{copy.customer.bought}</dt>
            <dd className={c.boughtProduct ? 'text-success' : undefined}>
              {c.boughtProduct ? copy.customer.yes : copy.customer.no}
            </dd>
          </div>
        </dl>
        {c.id ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2"
            nativeButton={false}
            render={<Link href={`/customers/${c.id}`} />}
          >
            {copy.customer.open}
          </Button>
        ) : null}
      </DataCard>
      <DataCard title={copy.store.title}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor="review-show">{copy.store.show}</Label>
              <span className="text-caption text-muted-foreground">{copy.store.showHelp}</span>
            </div>
            <Switch
              id="review-show"
              checked={detail.review.status === 'published'}
              disabled={busy}
              onCheckedChange={handleShow}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <Label htmlFor="review-feature">{copy.store.feature}</Label>
              <span className="text-caption text-muted-foreground">{copy.store.featureHelp}</span>
            </div>
            <Switch
              id="review-feature"
              checked={detail.review.featured}
              disabled={busy}
              onCheckedChange={handleFeature}
            />
          </div>
        </div>
      </DataCard>
      <Button
        type="button"
        variant="outline"
        className="self-start text-destructive"
        onClick={() => setDeleting(true)}
      >
        {copy.delete}
      </Button>
      <DeleteReviewsDialog
        ids={[detail.review.id]}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={onDeleted}
      />
    </>
  )
}
