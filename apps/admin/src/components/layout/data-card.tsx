import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import type { ReactNode } from 'react'
import { layoutContent } from '@/data/layout'
import ActionMenu, { type ActionItem } from './action-menu'
import DetailsLink from './details-link'

type DataCardProps = {
  title: string
  /** Small grey line above the title (a fulfilment group's origin, date and tracking). */
  meta?: ReactNode
  /** A small glyph after the title (the status icon of a fulfilment group). */
  icon?: ReactNode
  /** Right side of the header row: buttons, links, tabs. */
  action?: ReactNode
  /** Links behind the kebab; omitted means no kebab. */
  menu?: readonly ActionItem[]
  /** Outlined "Details" pill pinned to the bottom-right corner. */
  detailsHref?: string
  children: ReactNode
  className?: string
  /** Let tables and lists run edge to edge (they carry their own cell inset). */
  flush?: boolean
  /** `muted`: the light grey grouped sub-section (fulfilment groups). */
  tone?: 'default' | 'muted'
  /** Kept for older call sites; every card now uses the one section-title size. */
  size?: 'default' | 'kit'
  titleSize?: 'card' | 'table'
}

/**
 * The titled section every page is built from, after the Saleor Dashboard card (BSD-3).
 * On its own it is a white card on a hairline; inside `DetailLayout` or a list page
 * (`[data-layout=sections]`) it is a flat, edge-to-edge section with a hairline under it.
 * Header: optional grey meta line, the 1.25rem regular title with an optional glyph,
 * actions on the right; body 16px below.
 */
export default function DataCard({
  title,
  meta,
  icon,
  action,
  menu,
  detailsHref,
  children,
  className,
  flush,
  tone = 'default',
}: DataCardProps) {
  return (
    <Card
      className={cn(
        'relative h-full gap-0 rounded-lg p-5 in-data-[layout=sections]:h-auto in-data-[layout=sections]:rounded-none in-data-[layout=sections]:px-4 in-data-[layout=sections]:py-6 md:in-data-[layout=sections]:px-6',
        tone === 'muted' && 'bg-background bg-none',
        detailsHref && 'pb-16',
        className,
      )}
    >
      <div className="flex min-h-9 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {meta ? (
            <div className="text-caption font-normal text-muted-foreground">{meta}</div>
          ) : null}
          <div className="flex items-center gap-2">
            <h2 className="text-card-title text-ink-strong">{title}</h2>
            {icon ? (
              <span className="flex text-muted-foreground [&_svg]:size-4">{icon}</span>
            ) : null}
          </div>
        </div>
        {action || menu ? (
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {menu ? <ActionMenu label={layoutContent.moreActions} size="sm" items={menu} /> : null}
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          'mt-4',
          flush && '-mx-5 in-data-[layout=sections]:-mx-4 md:in-data-[layout=sections]:-mx-6',
        )}
      >
        {children}
      </div>
      {detailsHref ? (
        <div className="absolute right-5 bottom-5">
          <DetailsLink href={detailsHref} />
        </div>
      ) : null}
    </Card>
  )
}
