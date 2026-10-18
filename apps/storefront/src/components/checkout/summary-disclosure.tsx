'use client'

import { type ReactNode, useEffect, useId, useState } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'

type SummaryDisclosureProps = {
  /** The amount on the bar, formatted: what the shopper will pay. */
  totalLabel: string
  /** Shows a shimmer instead of the amount while shipping is re-quoted. */
  updating?: boolean
  children: ReactNode
}

/** The two-column layout starts here (Tailwind `lg`). */
const WIDE = '(min-width: 64rem)'

/**
 * On a phone the order summary folds into a "Show order summary · ₹X" bar at the top, so
 * the form comes first; tapping it opens the summary in place. From `lg` up the summary
 * is always open and the bar is gone. Height eases open, and not at all with reduced motion.
 */
export default function SummaryDisclosure({
  totalLabel,
  updating = false,
  children,
}: SummaryDisclosureProps) {
  // Hooks
  const id = useId()
  const [open, setOpen] = useState(false)
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const sync = () => setWide(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // Event handlers
  const handleToggle = () => setOpen((o) => !o)

  // Render logic
  const shown = open || wide

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={handleToggle}
        className="-mx-5! flex min-h-14 items-center justify-between gap-3 border-y! border-ck-summary-line! bg-transparent! px-5 text-left text-[0.9375rem]! text-ck-summary-ink! outline-none focus-visible:[box-shadow:inset_0_0_0_3px_var(--ck-ring)] sm:-mx-8! sm:px-8 lg:hidden"
      >
        <span className="flex items-center gap-2 font-medium">
          <CheckoutIcon name="bag" className="size-[1.125rem]" />
          {open ? content.hideSummary : content.showSummary}
          <CheckoutIcon
            name="chevron"
            className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </span>
        {updating ? (
          <span
            aria-hidden="true"
            className="h-4 w-16 animate-pulse rounded bg-ck-summary-line motion-reduce:animate-none"
          />
        ) : (
          <span className="text-[1.125rem] font-semibold tracking-[-0.01em] tabular-nums">
            {totalLabel}
          </span>
        )}
      </button>
      <div
        id={id}
        inert={!shown}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none lg:grid-rows-[1fr] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden lg:overflow-visible">
          <div className="pt-6 pb-7 lg:pt-0 lg:pb-0">{children}</div>
        </div>
      </div>
    </div>
  )
}
