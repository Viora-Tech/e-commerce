'use client'

import { type ReactNode, useRef, useState } from 'react'
import { checkoutContent as content } from '@/data/checkout'
import type { FilledRow } from '@/lib/checkout-filled-rows'

type CheckoutFilledRowsProps = {
  /** The card's part is complete. */
  done: boolean
  rows: FilledRow[]
  /** The card's fields. They stay in the form while hidden, so Pay still sends them. */
  children: ReactNode
}

/**
 * A card that arrives filled in reads as neat rows, like the admin's settings lists, with Edit
 * opening the fields. Once the shopper focuses a field or presses Edit the card stays open for
 * good, so it can never fold while they type. If it stops being complete the fields come back.
 */
export default function CheckoutFilledRows({ done, rows, children }: CheckoutFilledRowsProps) {
  // Hooks
  const fields = useRef<HTMLDivElement>(null)
  const [touched, setTouched] = useState(false)

  // Event handlers
  const handleTouch = () => setTouched(true)
  const handleEdit = () => {
    setTouched(true)
    requestAnimationFrame(() => fields.current?.querySelector('input')?.focus())
  }

  // Render logic
  const folded = done && !touched

  return (
    <>
      {folded ? (
        <dl className="divide-y divide-ck-line rounded-[calc(var(--ck-radius)*1.2)] border border-ck-line">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 text-[0.875rem] sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:px-4"
            >
              <dt className="text-ck-muted">{row.label}</dt>
              <dd className="font-medium break-words text-ck-ink">{row.value}</dd>
              <button
                type="button"
                onClick={handleEdit}
                aria-label={content.filled.editLabel(row.label)}
                className="cursor-pointer rounded-sm text-[0.8125rem] text-ck-muted underline underline-offset-2 outline-none transition-colors duration-150 hover:text-ck-ink focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] motion-reduce:transition-none"
              >
                {content.filled.edit}
              </button>
            </div>
          ))}
        </dl>
      ) : null}
      <div ref={fields} onFocusCapture={handleTouch} className={folded ? 'hidden' : 'contents'}>
        {children}
      </div>
    </>
  )
}
