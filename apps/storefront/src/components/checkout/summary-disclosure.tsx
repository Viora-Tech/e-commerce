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
 * On a phone the order summary folds into a "Show order summary ▾ · ₹X" card at the top
 * (design: checkout-design Mobile), so the form comes first; tapping it opens the summary in
 * place. From `lg` up the summary
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
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[inherit] border-0! bg-transparent! px-4 py-3.5 text-left text-ck-summary-ink! outline-none focus-visible:[box-shadow:inset_0_0_0_3px_var(--ck-ring)] lg:hidden"
      >
        <span className="flex items-center gap-2 text-[0.8125rem] font-semibold">
          {open ? content.hideSummary : content.showSummary}
          <CheckoutIcon
            name="chevron"
            className={`size-3.5 transition-[rotate] duration-200 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </span>
        {updating ? (
          <span
            aria-hidden="true"
            className="h-4 w-16 animate-pulse rounded bg-ck-summary-line motion-reduce:animate-none"
          />
        ) : (
          <span className="text-[1.0625rem] font-extrabold tracking-[-0.01em] tabular-nums">
            {totalLabel}
          </span>
        )}
      </button>
      <div
        id={id}
        inert={!shown}
        className={`grid transition-[grid-template-rows] duration-250 ease-out motion-reduce:transition-none lg:grid-rows-[1fr] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden lg:overflow-visible">
          <div className="border-t border-ck-summary-line px-4 pt-3.5 pb-4 lg:border-0 lg:p-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
