'use client'

import { useState, useTransition } from 'react'
import { discountFieldContent as content } from '@/data/cart'
import type { CartDiscountView } from '@/lib/discount-actions'
import { applyDiscountAction, removeDiscountAction } from '@/lib/discount-actions'

type DiscountCodeFieldProps = {
  storeId: string
  discount: CartDiscountView | null
}

/**
 * Code entry for the cart and checkout summaries. A working code shows as a
 * chip with a remove button; an automatic offer shows as a chip without one.
 * No <form> of its own: the checkout summary sits inside the checkout form, and a nested
 * form is invalid HTML (the browser drops it, so hydration fails). Enter applies the code.
 */
export default function DiscountCodeField({ storeId, discount }: DiscountCodeFieldProps) {
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
      const r = await applyDiscountAction(storeId, trimmed)
      if (!r.ok) {
        setError(content.errors[r.reason] ?? content.errors.invalid ?? null)
        return
      }
      setCode('')
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter applies the code instead of submitting the whole checkout.
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleApply()
  }

  const handleRemove = () => {
    setError(null)
    start(() => removeDiscountAction(storeId))
  }

  // Render logic
  const applied = discount?.label ? discount : null
  const rejected = discount?.codeRejected ?? null

  return (
    <div className="discount-field">
      {applied ? (
        <div className="discount-field__chip text-small">
          <span>{applied.code ? content.applied(applied.code) : content.automatic}</span>
          {applied.code ? (
            <button
              type="button"
              className="discount-field__remove"
              onClick={handleRemove}
              disabled={pending}
            >
              {content.remove}
            </button>
          ) : null}
        </div>
      ) : null}
      {!applied?.code ? (
        <div className="discount-field__form">
          <label className="field discount-field__input">
            <span className="field__label text-small">{content.label}</span>
            <input
              className="field__input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder={content.placeholder}
              autoComplete="off"
              autoCapitalize="characters"
              disabled={pending}
            />
          </label>
          <button
            type="button"
            className="btn btn--secondary btn--small discount-field__apply"
            onClick={handleApply}
            disabled={pending || !code.trim()}
          >
            {content.apply}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="discount-field__error text-small" role="alert">
          {error}
        </p>
      ) : null}
      {rejected && !applied ? (
        <p className="discount-field__error text-small" role="status">
          {content.errors[rejected] ?? content.errors.invalid}
        </p>
      ) : null}
    </div>
  )
}
