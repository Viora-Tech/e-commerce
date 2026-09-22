'use client'

import { ArrowLeft, ArrowRight } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { layoutContent } from '@/data/layout'

type KitPaginationProps = {
  page: number
  pageCount: number
  onChange: (page: number) => void
  className?: string
}

/** Pages to show: first, last, and a window around the current one; `null` is the "....." gap (14:1291). */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const out: (number | null)[] = [1]
  const lo = Math.max(2, page - 1)
  const hi = Math.min(pageCount - 1, page + 1)
  if (lo > 2) out.push(null)
  for (let p = lo; p <= hi; p++) out.push(p)
  if (hi < pageCount - 1) out.push(null)
  out.push(pageCount)
  return out
}

/* Sheet 14:1272 / 14:1280 / 14:1276: 42px outline Previous/Next, 36px page squares 12px apart;
   the active square is Surf Crest with a 15/700 Cyprus figure, others a Neutral/300 hairline with 15/500. */
const NAV =
  'inline-flex h-[2.625rem] items-center gap-1 rounded-md border border-line bg-card px-2 text-kit-cell text-ink-strong transition-colors hover:bg-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-6'
const SQUARE =
  'inline-flex size-9 items-center justify-center rounded-sm text-kit-cell text-ink-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export default function KitPagination({
  page,
  pageCount,
  onChange,
  className,
}: KitPaginationProps) {
  // Event handlers
  const handlePrev = () => onChange(Math.max(1, page - 1))
  const handleNext = () => onChange(Math.min(pageCount, page + 1))

  // Early returns
  if (pageCount <= 1) return null

  // Render logic
  const pages = pageWindow(page, pageCount)

  return (
    <nav
      aria-label={layoutContent.pagination.label}
      className={cn('flex items-center justify-between', className)}
    >
      <button type="button" onClick={handlePrev} disabled={page <= 1} className={NAV}>
        <ArrowLeft aria-hidden="true" />
        {layoutContent.pagination.previous}
      </button>
      <div className="flex items-center gap-3">
        {pages.map((p, i) =>
          p === null ? (
            <span
              key={`gap-${i === 1 ? 'a' : 'b'}`}
              className={cn(SQUARE, 'border border-line font-bold')}
              aria-hidden="true"
            >
              .....
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                SQUARE,
                p === page
                  ? 'bg-primary-tint font-bold'
                  : 'border border-line font-medium hover:bg-background',
              )}
            >
              {p}
            </button>
          ),
        )}
      </div>
      <button type="button" onClick={handleNext} disabled={page >= pageCount} className={NAV}>
        {layoutContent.pagination.next}
        <ArrowRight aria-hidden="true" />
      </button>
    </nav>
  )
}
