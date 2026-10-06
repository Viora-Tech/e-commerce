'use client'

import { useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CodeEntry from '@/components/checkout/code-entry'
import { discountFieldContent as content } from '@/data/cart'
import { checkoutContent } from '@/data/checkout'
import { applyDiscountAction, removeDiscountAction } from '@/lib/discount-actions'
import type { CartDiscountView } from '@/lib/discount-view'

type CheckoutDiscountProps = {
  discount: CartDiscountView | null
}

/**
 * The discount code in the checkout summary: the same server actions as the cart's field,
 * drawn in the checkout's look. A working code is a chip with Remove; an automatic offer
 * is a chip without it. The page re-renders with the new discount after either action.
 */
export default function CheckoutDiscount({ discount }: CheckoutDiscountProps) {
  // Hooks
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // Event handlers
  const handleApply = () => {
    const trimmed = code.trim()
    if (!trimmed) return
    setError(null)
    start(async () => {
      const r = await applyDiscountAction(trimmed)
      if (!r.ok) {
        setError(content.errors[r.reason] ?? content.errors.invalid ?? null)
        return
      }
      setCode('')
    })
  }

  const handleRemove = () => {
    setError(null)
    start(() => removeDiscountAction())
  }

  // Render logic
  const applied = discount?.label ? discount : null
  const rejected = discount?.codeRejected ?? null
  const shownError =
    error ??
    (rejected && !applied ? (content.errors[rejected] ?? content.errors.invalid ?? null) : null)
  const chip = applied ? (
    <div className="flex items-center justify-between gap-3 text-[0.875rem]">
      <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-ck-summary-line px-3 py-1 font-medium">
        <CheckoutIcon name="tag" className="size-3.5" />
        <span className="truncate">
          {applied.code ? content.applied(applied.code) : content.automatic}
        </span>
      </span>
      {applied.code ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={pending}
          className="shrink-0 rounded-sm bg-transparent! p-0! text-[0.8125rem]! text-ck-summary-ink! underline underline-offset-4 opacity-70 outline-none hover:opacity-100 focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:opacity-40"
        >
          {content.remove}
        </button>
      ) : null}
    </div>
  ) : null

  return (
    <CodeEntry
      icon="tag"
      openLabel={checkoutContent.codes.discount}
      inputLabel={content.label}
      placeholder={content.placeholder}
      applyLabel={content.apply}
      code={code}
      pending={pending}
      error={shownError}
      chips={chip}
      hideEntry={Boolean(applied?.code)}
      onCode={setCode}
      onApply={handleApply}
    />
  )
}
