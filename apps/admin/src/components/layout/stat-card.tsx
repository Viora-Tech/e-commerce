import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'
import CardMenu, { type MenuLink } from './card-menu'
import DeltaChip from './delta-chip'
import DetailsLink from './details-link'

type StatCardProps = {
  title: string
  /** "Last 7 days", 8px under the title. */
  period: string
  value: string
  /** Word after the number, e.g. "Sales". */
  unit?: string
  /** Percent change vs the previous period; sign decides colour. */
  delta?: number | null
  /** Set when a rise is bad news (cancellations) so the colours flip. */
  invert?: boolean
  /** "Previous 7 days ($235)" line; the value is highlighted. */
  previous?: { label: string; value: string }
  detailsHref?: string
  detailsLabel?: string
  /** Links behind the kebab; defaults to the Details destination. */
  menu?: MenuLink[]
  /** Replaces the number block (the Pending & cancelled tile, 5:1528). */
  children?: ReactNode
  className?: string
}

/**
 * Frame 5:1494 "Base" (361 x 222, padding 20): title 18/26 with a 20px kebab,
 * "Last 7 days" 13/17 at y=54, the 32/38 figure at y=91 with unit and delta
 * beside it, the previous-period line at y=137, and the 96 x 32 Details pill
 * pinned to the bottom-right corner.
 */
export default function StatCard({
  title,
  period,
  value,
  unit,
  delta,
  invert,
  previous,
  detailsHref,
  detailsLabel,
  menu,
  children,
  className,
}: StatCardProps) {
  const items =
    menu ??
    (detailsHref ? [{ label: detailsLabel ?? layoutContent.details, href: detailsHref }] : [])
  return (
    <Card className={cn('relative h-[13.875rem] gap-0 p-5', className)}>
      <div className="flex h-[1.625rem] items-center justify-between">
        <p className="text-kit-title text-foreground">{title}</p>
        {items.length > 0 ? <CardMenu items={items} /> : null}
      </div>
      <p className="mt-2 text-kit-body text-muted-foreground">{period}</p>
      {children ?? (
        <div className="mt-5 flex h-[2.375rem] items-center gap-4">
          <p className="text-kit-stat text-ink-strong tabular-nums">{value}</p>
          <div className="flex items-center gap-1.5">
            {unit ? <span className="text-kit-cell text-foreground">{unit}</span> : null}
            <DeltaChip delta={delta} invert={invert} size="kit" />
          </div>
        </div>
      )}
      {previous ? (
        <p className="mt-2 text-kit-body text-muted-foreground">
          {previous.label} <span className="text-link">({previous.value})</span>
        </p>
      ) : null}
      {detailsHref ? (
        <div className="absolute bottom-5 right-5">
          <DetailsLink href={detailsHref} label={detailsLabel} />
        </div>
      ) : null}
    </Card>
  )
}
