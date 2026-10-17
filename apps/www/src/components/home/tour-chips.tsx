'use client'

import { cn } from '@commerce/ui/lib/utils'
import { homeContent, type TourItem } from '@/data/home'

type TourChipsProps = {
  items: readonly TourItem[]
  active: number
  paused: boolean
  onSelect: (index: number) => void
  onFinished: () => void
}

/** Phone layout: the rail becomes a horizontally scrolling chip row with a progress underline. */
export default function TourChips({ items, active, paused, onSelect, onFinished }: TourChipsProps) {
  return (
    <div
      role="tablist"
      aria-label={homeContent.tour.tablistLabel}
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:hidden"
    >
      {items.map((item, index) => {
        const selected = index === active
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="tour-panel"
            onClick={() => onSelect(index)}
            className={cn(
              'relative h-9 shrink-0 overflow-hidden rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              selected
                ? 'border-border-strong bg-card text-foreground'
                : 'border-border text-muted-foreground',
            )}
          >
            {item.title}
            {selected ? (
              <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 bg-border">
                <span
                  key={active}
                  data-paused={paused}
                  onAnimationEnd={onFinished}
                  className="animate-tour-fill-x block size-full bg-cta"
                />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
