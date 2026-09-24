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
          <div className="flex flex-col gap-4 border-border border-b px-4 py-5 md:px-6">
            {header}
          </div>
          <div className="flex flex-col">{main}</div>
        </div>
        {side ? (
          <aside className="flex min-w-0 flex-col border-border border-t lg:border-t-0">
            {side}
          </aside>
        ) : null}
      </div>
      {children}
    </>
  )
}
