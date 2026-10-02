'use client'

import { cn } from '@commerce/ui/lib/utils'
import Image from 'next/image'

type CollectionCardProps = {
  title: string
  imageUrl: string | null
  count: number
  selected: boolean
  onSelect: () => void
}

/**
 * Frame 5:4095: white card, 1 Ambient lift, radius 6, 12px inset, a 64px
 * radius-4 thumb with a Neutral/300 hairline and an 18/500 label beside it.
 * Clicking one filters the table below, so it is a button rather than a link.
 */
export default function CollectionCard({
  title,
  imageUrl,
  count,
  selected,
  onSelect,
}: CollectionCardProps) {
  // Render logic
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-3 rounded-md bg-card p-3 text-left shadow-card motion-press hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'ring-2 ring-primary',
      )}
    >
      <span className="relative size-16 shrink-0 overflow-hidden rounded-sm border border-line bg-background">
        {imageUrl ? (
          <Image src={imageUrl} alt="" width={64} height={64} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-kit-title text-muted-foreground">
            {title.slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-kit-title font-medium text-foreground">{title}</span>
        <span className="text-kit-body text-muted-foreground tabular-nums">{count}</span>
      </span>
    </button>
  )
}
