import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type SettingsCardProps = {
  title?: string
  description?: string
  id?: string
  children: ReactNode
  className?: string
}

/** A settings card (Proofly): raised panel with a small title and help line over its rows. */
export default function SettingsCard({
  title,
  description,
  id,
  children,
  className,
}: SettingsCardProps) {
  return (
    <section
      id={id}
      className={cn(
        'flex scroll-mt-6 flex-col gap-5 rounded-2xl bg-card p-6 shadow-card ring-1 ring-hairline',
        className,
      )}
    >
      {title ? (
        <header className="flex flex-col gap-0.5">
          <h2 className="text-body font-semibold text-ink-strong">{title}</h2>
          {description ? (
            <p className="text-caption font-normal text-muted-foreground">{description}</p>
          ) : null}
        </header>
      ) : null}
      <div className="flex flex-col">{children}</div>
    </section>
  )
}
