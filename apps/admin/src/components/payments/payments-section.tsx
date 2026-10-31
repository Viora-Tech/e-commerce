import type { ReactNode } from 'react'

type PaymentsSectionProps = {
  id: string
  heading: string
  description: string
  /** The header's button ("+ Add provider"), right-aligned beside the heading. */
  action?: ReactNode
  /** `li` rows, usually each holding a `SettingsLinkRow`; or an empty state when `empty`. */
  children: ReactNode
  /** Shown inside the card instead of the row list. */
  empty?: ReactNode
}

/**
 * One section of Settings → Payments, Shopify style: a heading and one-line description with
 * its action on the right, over a card of rows split by hairlines.
 */
export default function PaymentsSection({
  id,
  heading,
  description,
  action,
  children,
  empty,
}: PaymentsSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-6 flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={`${id}-heading`} className="text-card font-semibold text-ink-strong">
            {heading}
          </h2>
          <p className="text-caption text-muted-foreground">{description}</p>
        </div>
        {action}
      </header>
      <div className="overflow-hidden rounded-xl surface-card">
        {empty ?? (
          <ul className="flex flex-col [&>li]:border-hairline [&>li]:border-b [&>li:last-child]:border-b-0">
            {children}
          </ul>
        )}
      </div>
    </section>
  )
}
