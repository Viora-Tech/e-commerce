import type { ReactNode } from 'react'

type ListSectionProps = {
  title: ReactNode
  /** One grey line under the title. */
  subtitle?: ReactNode
  /** Right of the title: usually the "+ Rule" style button. */
  action?: ReactNode
  /** `ListRow`s; or an empty state in their place. */
  children: ReactNode
}

/**
 * A titled list on the Program page (Essential Loyalty's layout): the title and its button sit
 * above a grey well whose rows are `ListRow`s, the first one raised.
 */
export default function ListSection({ title, subtitle, action, children }: ListSectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-card-title text-ink-strong">{title}</h2>
          {subtitle ? <p className="text-caption text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      <ul className="flex flex-col gap-1 rounded-lg border border-line bg-muted p-1">{children}</ul>
    </section>
  )
}
