import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import type { ReactNode } from 'react'
import CardMenu, { type MenuLink } from './card-menu'
import DetailsLink from './details-link'

type DataCardProps = {
  title: string
  /** Right side of the 32px header row: filter button, link, tabs. */
  action?: ReactNode
  /** Links behind the kebab; omitted means no kebab. */
  menu?: readonly MenuLink[]
  /** Outlined "Details" pill pinned to the bottom-right corner. */
  detailsHref?: string
  children: ReactNode
  className?: string
  /** Let tables and lists run edge to edge (they carry their own cell inset). */
  flush?: boolean
  /** Kept for older call sites; every card now uses the one card-title size. */
  size?: 'default' | 'kit'
  titleSize?: 'card' | 'table'
}

/**
 * The card every section sits in, after the Saleor Dashboard card (BSD-3): white on
 * a hairline, 20px inset, a 32px header row with a 15px/600 title, body 16px below.
 */
export default function DataCard({
  title,
  action,
  menu,
  detailsHref,
  children,
  className,
  flush,
}: DataCardProps) {
  return (
    <Card className={cn('relative h-full gap-0 p-5', detailsHref && 'pb-16', className)}>
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 className="text-card-title text-ink-strong">{title}</h2>
        <div className="flex items-center gap-2">
          {action}
          {menu ? <CardMenu items={menu} /> : null}
        </div>
      </div>
      <div className={cn('mt-4', flush && '-mx-5')}>{children}</div>
      {detailsHref ? (
        <div className="absolute right-5 bottom-5">
          <DetailsLink href={detailsHref} />
        </div>
      ) : null}
    </Card>
  )
}
