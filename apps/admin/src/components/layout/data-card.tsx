import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { MoreVertical, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'
import { DetailsLink } from './stat-card'

export type MenuLink = { label: string; href: string }

type DataCardProps = {
  title: string
  /** Right side of the 32px header row: filter button, link, tabs. */
  action?: ReactNode
  /** Links behind the 20px kebab (5:1499); omitted means no kebab. */
  menu?: readonly MenuLink[]
  /** Outlined "Details" pill pinned to the bottom-right 20px corner. */
  detailsHref?: string
  children: ReactNode
  className?: string
  /** Let tables run edge to edge (they carry their own 24px cell inset). */
  flush?: boolean
}

/**
 * Frame 5:2032 / 5:2138: 20px padding, a 32px header row with an 18px title,
 * body 20px below, and the Details pill 20px from the bottom-right corner.
 */
export function DataCard({
  title,
  action,
  menu,
  detailsHref,
  children,
  className,
  flush,
}: DataCardProps) {
  return (
    <Card className={cn('relative gap-0 p-5', detailsHref && 'pb-16', className)}>
      <div className="flex h-8 items-center justify-between gap-3">
        <p className="text-card-title text-foreground">{title}</p>
        <div className="flex items-center gap-3">
          {action}
          {menu ? <CardMenu items={menu} /> : null}
        </div>
      </div>
      <div className={cn('mt-5', flush && '-mx-5')}>{children}</div>
      {detailsHref ? (
        <div className="absolute bottom-5 right-5">
          <DetailsLink href={detailsHref} />
        </div>
      ) : null}
    </Card>
  )
}

type CardMenuProps = { items: readonly MenuLink[]; label?: string }

/** 5:1499: the 20px kebab, backed by a real menu of links. */
export function CardMenu({ items, label = layoutContent.moreActions }: CardMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((it) => (
          <DropdownMenuItem key={it.href} render={<Link href={it.href} />}>
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type FilterButtonProps = { label?: string; items: readonly MenuLink[] }

/** 5:2141: 85 x 32 solid green button, 14px label, 20px sort glyph; opens the filter links. */
export function FilterButton({ label = layoutContent.filter, items }: FilterButtonProps) {
  if (items.length === 0) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-xs text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {label}
        <SlidersHorizontal className="size-5" strokeWidth={1.6} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {items.map((it) => (
          <DropdownMenuItem key={it.href} render={<Link href={it.href} />}>
            {it.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type BandHeadProps = { children: ReactNode; className?: string }

/** 5:2146: 48px tinted header band, 8px radius, 13px uppercase labels, 20px cell inset. */
export function BandHead({ children, className }: BandHeadProps) {
  return (
    <div
      className={cn(
        'grid h-12 items-center rounded-lg bg-primary-soft px-5 text-table-head uppercase text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
