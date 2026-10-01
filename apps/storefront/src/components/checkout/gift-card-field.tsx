'use client'

import { formatPaise } from '@commerce/blocks'
import { normaliseGiftCardCode } from '@commerce/core/gift-card-code'
import { useState, useTransition } from 'react'
import { giftCardFieldContent as content } from '@/data/checkout'
import { type AppliedGiftCard, checkGiftCardAction } from '@/lib/gift-card-actions'

type GiftCardFieldProps = {
  applied: AppliedGiftCard[]
  onApply: (card: AppliedGiftCard) => void
  onRemove: (code: string) => void
}

/**
 * Gift card entry in the checkout summary. Applied cards show as chips with
 * their balance; the amount each covers is worked out by the summary, and the
 * server re-checks every code when the order is placed.
 */
export default function GiftCardField({ applied, onApply, onRemove }: GiftCardFieldProps) {
  // Hooks
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  // Event handlers
  const handleApply = () => {
    const typed = code.trim()
    if (!typed) return
    setError(null)
    const key = normaliseGiftCardCode(typed)
    if (applied.some((c) => normaliseGiftCardCode(c.code) === key)) {
      setError(content.duplicate)
      return
    }
    start(async () => {
      const r = await checkGiftCardAction(typed)
      if (!r.ok) {
        setError(content.errors[r.reason] ?? content.errors.not_found ?? null)
        return
      }
      onApply(r.card)
      setCode('')
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter applies the card instead of submitting the whole checkout.
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleApply()
  }

  return (
    <div className="discount-field">
      {applied.map((c) => (
        <div key={c.code} className="discount-field__chip text-small">
          <span>
            {content.applied(c.lastCharacters)} · {content.balance(formatPaise(c.balancePaise))}
          </span>
          <button
            type="button"
            className="discount-field__remove"
            onClick={() => onRemove(c.code)}
            disabled={pending}
          >
            {content.remove}
          </button>
        </div>
      ))}
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
      {error ? (
        <p className="discount-field__error text-small" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
