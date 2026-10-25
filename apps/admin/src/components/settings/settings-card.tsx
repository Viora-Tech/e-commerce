import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

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

/** A settings card (Proofly): raised panel with a small title and help line over its rows. */
export default function SettingsCard({
  title,
  description,
  id,
  children,
  className,
  bodyClassName,
  footer,
}: SettingsCardProps) {
  return (
    <section
      id={id}
      className={cn('flex scroll-mt-6 flex-col gap-5 rounded-xl surface-card p-6', className)}
    >
      {title ? (
        <header className="flex flex-col gap-0.5">
          <h2 className="text-[0.9375rem] leading-[1.375rem] font-semibold text-ink-strong">
            {title}
          </h2>
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
