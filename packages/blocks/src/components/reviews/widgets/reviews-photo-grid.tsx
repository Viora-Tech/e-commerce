'use client'

import { type ReactNode, useRef, useState } from 'react'
import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import type { StoreReviewCard } from '../../../types'
import Icon from '../../icon'
import SectionHeading from '../../section-heading'
import WidgetReviewCard from './widget-review-card'

type ReviewsPhotoGridProps = {
  kicker: ReactNode
  heading: ReactNode
  reviews: StoreReviewCard[]
  columns: number
  showProduct: boolean
}

type Tile = { url: string; review: StoreReviewCard }

const COLUMNS: Record<number, string> = {
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-4 lg:grid-cols-5',
  6: 'md:grid-cols-4 lg:grid-cols-6',
}

/** One tile per photo, in the reviews' order. */
const tilesOf = (reviews: StoreReviewCard[]): Tile[] =>
  reviews.flatMap((review) => review.photos.map((url) => ({ url, review })))

/**
 * Customers' photos from published reviews in a square grid. A photo opens large in a dialog
 * with the review it came from.
 */
export default function ReviewsPhotoGrid({
  kicker,
  heading,
  reviews,
  columns,
  showProduct,
}: ReviewsPhotoGridProps) {
  // Hooks
  const [open, setOpen] = useState<Tile | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  // Event handlers
  const handleOpen = (tile: Tile) => {
    setOpen(tile)
    dialog.current?.showModal()
  }
  const handleClose = () => dialog.current?.close()

  // Render logic
  const tiles = tilesOf(reviews)
  const grid = COLUMNS[columns] ?? COLUMNS[4]

  return (
    <div className="page-width flex flex-col gap-6">
      {heading || kicker ? <SectionHeading kicker={kicker} heading={heading} /> : null}
      <ul className={`m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 ${grid}`}>
        {tiles.map((t) => (
          <li key={`${t.review.id}-${t.url}`}>
            <button
              type="button"
              onClick={() => handleOpen(t)}
              aria-label={copy.openPhoto(t.review.name)}
              className="block aspect-square w-full touch-manipulation overflow-hidden rounded-md bg-surface p-0 transition-[scale] duration-(--duration-press) ease-out active:scale-(--motion-card-press-scale)"
            >
              <img
                src={t.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        aria-label={open ? copy.photoAlt(open.review.name) : copy.close}
        onClose={() => setOpen(null)}
        className="m-auto! max-h-[92dvh] w-[min(52rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-[var(--radius-m)] border border-line bg-bg p-0 text-ink backdrop:bg-black/60"
      >
        {open ? (
          <div className="relative grid grid-cols-1 md:grid-cols-[1.4fr_1fr]">
            <img
              src={open.url}
              alt={copy.photoAlt(open.review.name)}
              className="max-h-[70dvh] w-full bg-surface object-contain"
            />
            <div className="p-5">
              <WidgetReviewCard
                review={open.review}
                cardStyle="plain"
                showProduct={showProduct}
                showPhotos={false}
                showDate
                clip={1200}
              />
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label={copy.close}
              className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-full bg-bg text-ink"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ) : null}
      </dialog>
    </div>
  )
}
