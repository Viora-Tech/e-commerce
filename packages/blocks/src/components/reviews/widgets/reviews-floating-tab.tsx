'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import type { StoreReviews } from '../../../types'
import Icon from '../../icon'
import RatingStars from '../../rating-stars'
import WidgetReviewCard from './widget-review-card'

type ReviewsFloatingTabProps = {
  /** The tab's text, e.g. "Reviews". */
  label: string
  heading: string
  position: 'left' | 'right'
  showProduct: boolean
  /** Loaded by the storefront for this embed; nothing is drawn without reviews. */
  data: StoreReviews | null | undefined
}

/**
 * The Reviews app's floating tab (an app embed, on every page): a small tab on the side of the
 * screen with the store's rating that opens a panel of recent reviews beside it. Escape, the
 * close button or the tab again close it.
 */
export default function ReviewsFloatingTab({
  label,
  heading,
  position,
  showProduct,
  data,
}: ReviewsFloatingTabProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const tab = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      tab.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Event handlers
  const handleClose = () => {
    setOpen(false)
    tab.current?.focus()
  }

  // Early returns
  if (!data || data.reviews.length === 0) return null

  // Render logic
  const side = position === 'left' ? 'left-0' : 'right-0'
  const tabShape =
    position === 'left' ? 'rounded-r-[var(--radius-m)]' : 'rounded-l-[var(--radius-m)]'
  const panelSide = position === 'left' ? 'left-14' : 'right-14'

  return (
    <>
      <button
        ref={tab}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={copy.openTab}
        onClick={() => setOpen((o) => !o)}
        className={`fixed top-1/2 z-40 flex -translate-y-1/2 touch-manipulation flex-col items-center gap-2 bg-brand px-2.5 py-4 text-on-brand shadow-lg transition-[scale] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) ${side} ${tabShape}`}
      >
        <Icon name="star" size={14} />
        <span className="text-xs font-semibold tabular-nums">{data.summary.rating.toFixed(1)}</span>
        <span className="text-xs font-medium [writing-mode:vertical-rl]">{label}</span>
      </button>
      <section
        id={panelId}
        aria-label={heading}
        hidden={!open}
        className={`fixed top-1/2 z-40 flex max-h-[70dvh] w-[min(22rem,calc(100vw-5rem))] -translate-y-1/2 flex-col overflow-hidden rounded-[var(--radius-m)] border border-line bg-bg text-ink shadow-xl ${panelSide}`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <span className="flex flex-col gap-1">
            <span className="text-base font-semibold">{heading}</span>
            <span className="flex items-center gap-2 text-xs text-muted">
              <RatingStars rating={data.summary.rating} hideValue />
              {copy.basedOn(data.summary.count)}
            </span>
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label={copy.close}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface"
          >
            <Icon name="close" size={14} />
          </button>
        </header>
        <ul className="m-0 flex list-none flex-col gap-3 overflow-y-auto overscroll-contain p-4">
          {data.reviews.map((r) => (
            <li key={r.id}>
              <WidgetReviewCard
                review={r}
                cardStyle="card"
                showProduct={showProduct}
                showPhotos
                showDate
                clip={220}
              />
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
