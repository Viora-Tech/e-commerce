import type { ReactNode } from 'react'

type PageHeadingProps = {
  /** One plain line about the page; the title itself is in the SiteHeader. */
  description?: string | undefined
  /** Buttons at the end of the row (Export CSV). */
  actions?: ReactNode
}

/** A page's toolbar row above its content: a muted line and its actions, as in dashboard-01. */
export default function PageHeading({ description, actions }: PageHeadingProps) {
  // Render logic
  return (
    <div className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      {description ? (
        <p className="max-w-[40rem] text-sm text-muted-foreground">{description}</p>
      ) : (
        <span />
      )}
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
