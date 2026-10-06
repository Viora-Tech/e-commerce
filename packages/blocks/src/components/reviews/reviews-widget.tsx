'use client'

import { useEffect, useRef, useState } from 'react'
import { reviewsWidgetContent as copy } from '../../data/reviews-widget'
import type { PublicReviewCard, ReviewsWidgetContext } from '../../types'
import ReviewCard from './review-card'
import ReviewForm from './review-form'
import ReviewsSummary from './reviews-summary'

type ReviewsWidgetProps = { context: ReviewsWidgetContext }

type Chip = 'all' | 'photos' | 'five' | 'four' | 'low'

const PAGE = 6

const FILTERS: Record<Chip, (r: PublicReviewCard) => boolean> = {
  all: () => true,
  photos: (r) => r.photos.length > 0,
  five: (r) => r.rating === 5,
  four: (r) => r.rating === 4,
  low: (r) => r.rating <= 3,
}

// `!`: the theme's unlayered `button { background: none; border: none }` reset beats utilities.
const CHIP =
  'inline-flex min-h-9 touch-manipulation items-center rounded-full border! border-solid! px-3.5 text-sm transition-[color,background-color,border-color,scale] duration-(--duration-press) ease-out active:scale-(--motion-press-scale)'

/**
 * The Reviews app on a product page (Storefront 21:8): the summary with per-star bars and
 * "Write a review" on the left, filter chips and review cards on the right, six at a time.
 * The form opens in a dialog; a shopper from a review request email lands with it open.
 */
export default function ReviewsWidget({ context }: ReviewsWidgetProps) {
  // Hooks
  const dialog = useRef<HTMLDialogElement>(null)
  const [chip, setChip] = useState<Chip>('all')
  const [shown, setShown] = useState(PAGE)
  const [formKey, setFormKey] = useState(0)
  useEffect(() => {
    if (context.openForm && context.write === 'open') dialog.current?.showModal()
  }, [context.openForm, context.write])

  // Event handlers
  const handleOpen = () => {
    setFormKey((k) => k + 1)
    dialog.current?.showModal()
  }
  const handleClose = () => dialog.current?.close()
  const handleChip = (next: Chip) => {
    setChip(next)
    setShown(PAGE)
  }

  // Render logic
  const showPhotos = context.showPhotos
  const list = context.reviews.filter(FILTERS[chip])
  const withPhotos = context.reviews.filter(FILTERS.photos).length
  const chips: { key: Chip; label: string }[] = [
    { key: 'all', label: copy.chips.all },
    ...(showPhotos && withPhotos > 0
      ? [{ key: 'photos' as const, label: copy.chips.photos(withPhotos) }]
      : []),
    { key: 'five', label: copy.chips.five },
    { key: 'four', label: copy.chips.four },
    { key: 'low', label: copy.chips.low },
  ]

  return (
    <div className="grid grid-cols-1 gap-8 text-left md:grid-cols-[18rem_1fr] md:gap-12">
      <div className="flex flex-col gap-4">
        <ReviewsSummary summary={context.summary} />
        {context.write === 'open' ? (
          <button type="button" className="btn btn--secondary w-full" onClick={handleOpen}>
            {copy.write}
          </button>
        ) : context.write === 'signin' ? (
          <a className="btn btn--secondary w-full" href={context.signInUrl}>
            {copy.signIn}
          </a>
        ) : null}
        {context.onlyVerified ? (
          <p className="m-0 text-sm text-muted">
            {context.write === 'not_buyer' ? copy.notBuyer : copy.onlyBuyers}
          </p>
        ) : null}
      </div>
      {context.reviews.length > 0 ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={chip === c.key}
                onClick={() => handleChip(c.key)}
                className={`${CHIP} ${chip === c.key ? 'border-ink! bg-ink! text-bg!' : 'border-line! bg-surface! text-ink! hover:border-ink!'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {list.length === 0 ? <p className="m-0 text-muted">{copy.noMatch}</p> : null}
          {list.slice(0, shown).map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              storeName={context.storeName}
              showPhotos={showPhotos}
            />
          ))}
          {list.length > shown ? (
            <button
              type="button"
              className="btn btn--secondary self-start"
              onClick={() => setShown((n) => n + PAGE)}
            >
              {copy.more}
            </button>
          ) : null}
        </div>
      ) : null}
      <dialog
        ref={dialog}
        aria-label={copy.form.title}
        className="m-auto! max-h-[92dvh] w-[min(32.5rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[var(--radius-m)] border border-line bg-surface p-0 text-ink backdrop:bg-black/55"
      >
        <ReviewForm key={formKey} context={context} onClose={handleClose} />
      </dialog>
    </div>
  )
}
