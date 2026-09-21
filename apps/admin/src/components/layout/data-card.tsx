import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'

type DataCardProps = {
  title: string
  /** Right side of the header: filter button, link, tabs… */
  action?: ReactNode
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
  detailsHref,
  children,
  className,
  flush,
}: DataCardProps) {
  return (
    <Card className={cn('gap-0 px-5 py-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-card-title">{title}</p>
        {action ? <div className="flex items-center gap-3">{action}</div> : null}
      </div>
      <div className={cn('mt-4', flush && '-mx-5')}>{children}</div>
      {detailsHref ? (
        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            render={<Link href={detailsHref} />}
            nativeButton={false}
          >
            {layoutContent.details}
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

/** Secondary "Filter" button; renders only with a handler so it is never a dead control. */
export function FilterButton({
  label = layoutContent.filter,
  onClick,
}: {
  label?: string
  onClick?: () => void
}) {
  if (!onClick) return null
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {label}
      <SlidersHorizontal aria-hidden="true" />
    </Button>
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
