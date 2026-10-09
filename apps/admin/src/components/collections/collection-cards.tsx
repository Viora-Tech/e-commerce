'use client'

import { ArrowLeft, ArrowRight } from '@commerce/ui/icons'
import { useRef, useState } from 'react'
import { collectionsListContent as copy } from '@/data/collections'
import CollectionCard from './collection-card'

export type CollectionSummary = {
  id: string
  title: string
  imageUrl: string | null
  productCount: number
}

type CollectionCardsProps = {
  collections: CollectionSummary[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

/** Frame 5:4094 / 5:4115: two rows of four, paged by the circular arrows at 5:4136. */
const PER_PAGE = 8

/** Sideways travel (px) of a swipe or trackpad scroll that turns the page. */
const SWIPE_PX = 40

/** Index of the final page; an empty or single-page list is page 0. */
const lastPageOf = (count: number) => Math.max(0, Math.ceil(count / PER_PAGE) - 1)

const arrowClass =
  'inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-card motion-press hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40'

export default function CollectionCards({
  collections,
  selectedId,
  onSelect,
}: CollectionCardsProps) {
  // Hooks
  const [page, setPage] = useState(0)
  const touchX = useRef<number | null>(null)
  const wheelLock = useRef(false)

  // Event handlers
  const handlePrevious = () => setPage((p) => Math.max(0, p - 1))
  const handleNext = () => setPage((p) => Math.min(lastPageOf(collections.length), p + 1))

  const handleTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchX.current
    touchX.current = null
    const end = e.changedTouches[0]?.clientX
    if (start === null || end === undefined || Math.abs(end - start) < SWIPE_PX) return
    if (end < start) handleNext()
    else handlePrevious()
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < SWIPE_PX / 2) return
    if (wheelLock.current) return
    wheelLock.current = true
    window.setTimeout(() => {
      wheelLock.current = false
    }, 400)
    if (e.deltaX > 0) handleNext()
    else handlePrevious()
  }

  // Early returns
  if (collections.length === 0) return null

  // Render logic
  const lastPage = lastPageOf(collections.length)
  const current = Math.min(page, lastPage)
  const pageCount = lastPage + 1
  const shown = collections.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE)

  return (
    <div className="flex items-center gap-4">
      {pageCount > 1 ? (
        <button
          type="button"
          onClick={handlePrevious}
          disabled={current === 0}
          aria-label={copy.previousPage}
          className={arrowClass}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
      ) : null}
      <div
        className="grid min-w-0 flex-1 touch-pan-y gap-5 sm:grid-cols-2 lg:grid-cols-4"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {shown.map((c) => (
          <CollectionCard
            key={c.id}
            title={c.title}
            imageUrl={c.imageUrl}
            count={c.productCount}
            selected={selectedId === c.id}
            onSelect={() => onSelect(selectedId === c.id ? null : c.id)}
          />
        ))}
      </div>
      {pageCount > 1 ? (
        <button
          type="button"
          onClick={handleNext}
          disabled={current === lastPage}
          aria-label={copy.nextPage}
          className={arrowClass}
        >
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
