'use client'

import { ArrowRight } from '@commerce/ui/icons'
import { useState } from 'react'
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

/** Frame 5:4094 / 5:4115: two rows of four, paged by the circular arrow at 5:4136. */
const PER_PAGE = 8

export default function CollectionCards({
  collections,
  selectedId,
  onSelect,
}: CollectionCardsProps) {
  // Hooks
  const [page, setPage] = useState(0)

  // Event handlers
  const handleNext = () =>
    setPage((p) => (p + 1) % Math.max(1, Math.ceil(collections.length / PER_PAGE)))

  // Early returns
  if (collections.length === 0) return null

  // Render logic
  const pageCount = Math.ceil(collections.length / PER_PAGE)
  const shown = collections.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  return (
    <div className="flex items-center gap-4">
      <div className="grid min-w-0 flex-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
          aria-label={copy.nextPage}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-foreground shadow-card motion-press hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowRight className="size-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
