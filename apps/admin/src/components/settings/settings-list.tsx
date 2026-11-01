import type { ReactNode } from 'react'

type SettingsListProps = {
  /** `li` rows, usually each holding a `SettingsLinkRow`. */
  children: ReactNode
  heading?: string
  description?: string
  /** Content under the rows inside the same card (an empty state). */
  after?: ReactNode
  /** Card actions under the rows, right-aligned like every card footer. */
  footer?: ReactNode
}

/**
 * A settings list as rows in one card (#147): a small heading, then rows split by hairlines,
 * each opening its own page with a ›. For lists (locations, domains, roles) that read better
 * as a list than as a row list + detail.
 */
export default function SettingsList({
  children,
  heading,
  description,
  after,
  footer,
}: SettingsListProps) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl surface-card">
      {heading ? (
        <header className="flex flex-col gap-0.5 border-hairline border-b px-5 pt-4 pb-3">
          <h2 className="text-body font-semibold text-ink-strong">{heading}</h2>
          {description ? <p className="text-caption text-muted-foreground">{description}</p> : null}
        </header>
      ) : null}
      <ul className="flex flex-col [&>li]:border-hairline [&>li]:border-b [&>li:last-child]:border-b-0">
        {children}
      </ul>
      {after ? <div className="border-hairline border-t">{after}</div> : null}
      {footer ? (
        <div className="flex flex-wrap items-center justify-end gap-2 border-hairline border-t px-5 py-3">
          {footer}
        </div>
      ) : null}
    </section>
  )
}
