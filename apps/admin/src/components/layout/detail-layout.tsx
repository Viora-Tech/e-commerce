import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type DetailLayoutProps = {
  /** The page header block (PageHeader, save bar, alerts), drawn above the main column. */
  header: ReactNode
  /** Main column sections, stacked edge to edge. */
  main: ReactNode
  /** Right column sections (customer, status, organisation). */
  side?: ReactNode
  /** Dialogs, print views and other out-of-flow children. */
  children?: ReactNode
  /** Extra classes on the grid, e.g. `print:hidden` when the page prints its own view. */
  className?: string
  /** Pins the side column in view on desktop instead of scrolling it with the (often much longer) main column. */
  stickySide?: boolean
}

/**
 * Detail page after the Saleor Dashboard detail layout (BSD-3): the white panel splits
 * into a fluid main column and a fixed right column, full height, divided by a 1px rule.
 * Everything inside is `[data-layout=sections]`, so cards (`DataCard`, shadcn `Card`)
 * render as flat titled sections separated by hairlines instead of floating cards.
 */
export default function DetailLayout({
  header,
  main,
  side,
  children,
  className,
  stickySide = false,
}: DetailLayoutProps) {
  return (
    <>
      <div
        data-layout="sections"
        className={cn(
          'grid min-h-full grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]',
          className,
        )}
      >
        <div className="flex min-w-0 flex-col border-border lg:border-r">
          <div className="sticky top-0 z-10 flex flex-col gap-4 border-border border-b bg-card px-4 py-5 transition-shadow duration-200 group-data-[scrolled]/main:shadow-[0_6px_16px_-10px_hsl(211_42%_16%/0.25)] md:px-6">
            {header}
          </div>
          <div className="flex flex-col">{main}</div>
        </div>
        {side ? (
          <aside
            className={cn(
              'flex min-w-0 flex-col border-border border-t lg:border-t-0',
              /* Height of the scrolling <main>: the window less the 3.5rem top bar (admin-frame). */
              stickySide &&
                'lg:sticky lg:top-0 lg:max-h-[calc(100svh-3.5rem)] lg:self-start lg:overflow-y-auto',
            )}
          >
            {side}
          </aside>
        ) : null}
      </div>
      {children}
    </>
  )
}
