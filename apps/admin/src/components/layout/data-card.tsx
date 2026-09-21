import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import type { ReactNode } from 'react'
import { CardMenu, type MenuLink } from './card-menu'
import { DetailsLink } from './details-link'

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
