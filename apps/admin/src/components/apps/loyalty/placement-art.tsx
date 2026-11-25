import { cn } from '@commerce/ui/lib/utils'
import type { PlacementId } from '@/lib/loyalty-placements'

type PlacementArtProps = {
  id: PlacementId
  className?: string
}

/** A grey bar for the sketches (text lines, image blocks). */
const BAR = 'rounded-sm bg-muted-foreground/20'

/**
 * A small sketch of where a placement shows on the storefront (a page frame with the element
 * marked in the primary colour), drawn with tokens so it follows the theme. Decorative only.
 */
export default function PlacementArt({ id, className }: PlacementArtProps) {
  // Render logic
  const accent = 'rounded-sm bg-primary'

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex h-20 w-28 shrink-0 flex-col gap-1.5 overflow-hidden rounded-md border border-border bg-muted p-2',
        className,
      )}
    >
      <span className={cn(BAR, 'h-1.5 w-full')} />
      {id === 'widget' ? (
        <>
          <span className={cn(BAR, 'h-6 w-full')} />
          <span className={cn(BAR, 'h-1.5 w-3/4')} />
          <span className="absolute right-1.5 bottom-1.5 size-4 rounded-full bg-primary" />
        </>
      ) : null}
      {id === 'productPoints' ? (
        <div className="flex flex-1 gap-1.5">
          <span className={cn(BAR, 'w-1/2')} />
          <span className="flex flex-1 flex-col gap-1">
            <span className={cn(BAR, 'h-1.5 w-full')} />
            <span className={cn(BAR, 'h-1.5 w-2/3')} />
            <span className={cn(accent, 'h-1.5 w-3/4')} />
            <span className={cn(BAR, 'mt-auto h-2.5 w-full')} />
          </span>
        </div>
      ) : null}
      {id === 'cardPoints' ? (
        <div className="grid flex-1 grid-cols-3 gap-1">
          {[0, 1, 2].map((n) => (
            <span key={n} className="flex flex-col gap-0.5">
              <span className={cn(BAR, 'flex-1')} />
              <span className={cn(BAR, 'h-1 w-full')} />
              <span className={cn(accent, 'h-1 w-2/3')} />
            </span>
          ))}
        </div>
      ) : null}
      {id === 'cartRedeem' ? (
        <div className="ml-auto flex w-3/5 flex-1 flex-col gap-1 rounded-sm bg-background p-1">
          <span className={cn(BAR, 'h-1.5 w-full')} />
          <span className={cn(BAR, 'h-1.5 w-2/3')} />
          <span className={cn(accent, 'h-2 w-full')} />
          <span className={cn(BAR, 'mt-auto h-2 w-full')} />
        </div>
      ) : null}
      {id === 'referralPopup' ? (
        <div className="mx-auto flex w-3/4 flex-1 flex-col items-center gap-1 rounded-sm bg-background p-1">
          <span className={cn(BAR, 'h-1.5 w-3/4')} />
          <span className={cn(BAR, 'h-1.5 w-full')} />
          <span className={cn(accent, 'h-2 w-full')} />
        </div>
      ) : null}
    </div>
  )
}
