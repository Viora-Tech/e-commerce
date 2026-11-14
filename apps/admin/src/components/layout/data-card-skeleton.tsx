import { cn } from '@commerce/ui/lib/utils'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import DataCard from '@/components/layout/data-card'

type DataCardSkeletonProps = {
  /** Field-height bars (2.25rem) under the title. */
  fields?: number
  /** Text-height bars (one body line each) after the fields. */
  lines?: number
  /** A fixed height for the whole card, so a card that loads on its own does not pop in. */
  className?: string
}

/* Widths for the text lines, so a stack of them reads as a paragraph, not a block. */
const LINE_WIDTHS = ['w-full', 'w-2/3', 'w-5/6', 'w-1/2'] as const

/**
 * A DataCard while its data loads: the real card (same surface, padding, title row and the
 * section style inside a detail page) with a bar for the title, field bars and text lines.
 * Detail, settings and order-page cards use it, so the card does not change when it fills in.
 */
export default function DataCardSkeleton({
  fields = 2,
  lines = 0,
  className,
}: DataCardSkeletonProps) {
  // Render logic
  return (
    <DataCard
      title={<Skeleton className="h-5 w-40" />}
      className={className}
      bodyClassName="flex flex-col gap-3"
    >
      {Array.from({ length: fields }, (_, i) => (
        <Skeleton key={`field-${i.toString()}`} className="h-9 w-full" />
      ))}
      {Array.from({ length: lines }, (_, i) => (
        <span key={`line-${i.toString()}`} className="flex h-5 items-center">
          <Skeleton className={cn('h-3.5', LINE_WIDTHS[i % LINE_WIDTHS.length])} />
        </span>
      ))}
    </DataCard>
  )
}
