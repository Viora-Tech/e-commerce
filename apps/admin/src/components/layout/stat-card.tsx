import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import { ArrowDown, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'
import { CardMenu, type MenuLink } from './data-card'

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

/** Percent change between two window values; null when there is nothing to compare against. */
export function percentDelta(value: number, previous: number): number | null {
  if (previous === 0) return value === 0 ? 0 : null
  return ((value - previous) / previous) * 100
}

/** 5:1508: 16px arrow glyph and a 14px figure, green up / red down. */
export function DeltaChip({
  delta,
  invert,
}: {
  delta: number | null | undefined
  invert?: boolean
}) {
  if (delta === null || delta === undefined) return null
  const flat = Math.abs(delta) < 0.05
  const up = delta > 0
  const good = invert ? !up : up
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center text-period tabular-nums',
        flat ? 'text-muted-foreground' : good ? 'text-success' : 'text-destructive',
      )}
    >
      {flat ? null : <Icon className="size-4" />}
      {flat ? layoutContent.noChange : `${Math.abs(delta).toFixed(1)}%`}
    </span>
  )
}

type DetailsLinkProps = { href: string; label?: string | undefined }

/** 5:1509: 96 x 32 outline pill in the link colour, 16px label. */
export function DetailsLink({ href, label = layoutContent.details }: DetailsLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex h-8 min-w-24 items-center justify-center rounded-full border border-link px-6 text-[0.8125rem] leading-5  text-link transition-colors hover:bg-link-soft"
    >
      {label}
    </Link>
  )
}

/**
 * Frame 5:1494 "Base" (361 x 222): title row with a 20px kebab, period label,
 * the 32px figure with its unit and delta 20px lower, the previous-period
 * line, and the Details pill pinned to the bottom-right 20px corner.
 */
export function StatCard({
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
    <Card className={cn('relative h-48 gap-0 p-5', className)}>
      <div className="flex items-start justify-between">
        <p className="text-card-title text-foreground">{title}</p>
        {items.length > 0 ? (
          <div className="mt-0.5">
            <CardMenu items={items} />
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-period text-muted-foreground">{period}</p>
      {children ?? (
        <div className="mt-5 flex items-center gap-4">
          <p className="text-stat text-ink-strong tabular-nums">{value}</p>
          <div className="flex items-center gap-1">
            {unit ? (
              <span className="text-[0.8125rem] leading-5 text-foreground">{unit}</span>
            ) : null}
            <DeltaChip delta={delta} invert={invert} />
          </div>
        </div>
      )}
      {previous ? (
        <p className="mt-2 text-period text-muted-foreground">
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
