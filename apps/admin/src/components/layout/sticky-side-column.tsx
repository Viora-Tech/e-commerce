import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type StickySideColumnProps = {
  children: ReactNode
  /** The gap between cards: 1.25rem on the Saleor pages, 1.5rem on the Proofly and order frames. */
  gap?: 5 | 6
  /** `aside` on the order page; a plain `div` elsewhere. */
  as?: 'div' | 'aside'
}

const GAP_CLASS = { 5: 'gap-5', 6: 'gap-6' } as const

/**
 * The right column of a detail page: stacked cards that stay in view on desktop and scroll
 * on their own when taller than the screen.
 *
 * Every card keeps its full height (`[&>*]:shrink-0`). Cards clip their content
 * (`overflow-hidden` on the Card), which makes a flex item's minimum height zero, so in a
 * column capped at the screen's height the browser squashed every card to share the space
 * and cut off whatever did not fit (#671: Contact, Addresses and Marketing consent clipped
 * on the customer page). Page columns, the order frame and the Proofly frame all use this
 * one component, so the rule cannot drift between them again.
 */
export default function StickySideColumn({ children, gap = 5, as = 'div' }: StickySideColumnProps) {
  // Render logic
  const Tag = as

  return (
    <Tag
      className={cn(
        'flex min-w-0 flex-col *:shrink-0 lg:sticky lg:top-6 lg:-m-1 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:p-1 no-scrollbar',
        GAP_CLASS[gap],
      )}
    >
      {children}
    </Tag>
  )
}
