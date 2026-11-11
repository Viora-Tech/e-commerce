'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { useDrillHeaderTitle } from './settings-drill'

type SettingsCardProps = {
  title?: string
  description?: string
  id?: string
  children: ReactNode
  className?: string
  /** Classes for the body under the title (default stacks children in a column). */
  bodyClassName?: string
  /** Card actions under the body, right-aligned like every card footer. */
  footer?: ReactNode
}

/**
 * A settings card (Proofly): raised panel with a small title and help line over its rows. Inside
 * an open settings row whose page header already names it, a title that repeats the header is
 * left out (the help line stays), so the screen has one heading.
 */
export default function SettingsCard({
  title,
  description,
  id,
  children,
  className,
  bodyClassName,
  footer,
}: SettingsCardProps) {
  // Hooks
  const headerTitle = useDrillHeaderTitle()

  // Render logic
  const heading = title && title !== headerTitle ? title : undefined

  return (
    <section
      id={id}
      className={cn('flex scroll-mt-6 flex-col gap-5 rounded-xl surface-card p-6', className)}
    >
      {heading || description ? (
        <header className="flex flex-col gap-0.5">
          {heading ? (
            <h2 className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ink-strong">
              {heading}
            </h2>
          ) : null}
          {description ? (
            <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
      ) : null}
      <div className={cn('flex flex-col', bodyClassName)}>{children}</div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>
      ) : null}
    </section>
  )
}
