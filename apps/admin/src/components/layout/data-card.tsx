import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { MoreVertical } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'

type DataCardProps = {
  title: string
  /** Right side of the header: filter button, link, tabs… */
  action?: ReactNode
  kebab?: boolean
  /** Outlined "Details" pill in the bottom-right corner. */
  detailsHref?: string
  children: ReactNode
  className?: string
  /** Remove the 20px inner padding around `children` (tables bring their own). */
  flush?: boolean
}

/** Kit content card: bold title row, optional action, body, optional Details pill. */
export function DataCard({
  title,
  action,
  kebab,
  detailsHref,
  children,
  className,
  flush,
}: DataCardProps) {
  return (
    <Card className={cn('gap-0 px-5 py-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-card-title">{title}</p>
        <div className="flex items-center gap-3">
          {action}
          {kebab ? (
            <MoreVertical className="size-5 text-muted-foreground" aria-hidden="true" />
          ) : null}
        </div>
      </div>
      <div className={cn('mt-4', flush && '-mx-5')}>{children}</div>
      {detailsHref ? (
        <div className="mt-4 flex justify-end">
          <Link
            href={detailsHref}
            className="inline-flex h-8 items-center rounded-full border border-link px-4 text-[15px] text-link transition-colors hover:bg-link-soft"
          >
            {layoutContent.details}
          </Link>
        </div>
      ) : null}
    </Card>
  )
}

/** Green "Filter" button from the kit; wire `onClick` when the card gets real filters. */
export function FilterButton({
  label = layoutContent.filter,
  onClick,
}: {
  label?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
    >
      {label}
      <svg
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M3 5h14M6 10h8M8.5 15h3" strokeLinecap="round" />
      </svg>
    </button>
  )
}

/** Table header band used inside DataCards (tinted, rounded, uppercase). */
export function BandHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'mx-5 grid h-12 items-center rounded-lg bg-primary-soft px-5 text-table-head',
        className,
      )}
    >
      {children}
    </div>
  )
}
