'use client'

import { formatPaise } from '@commerce/blocks'
import { normaliseGiftCardCode } from '@commerce/core/gift-card-code'
import { useState, useTransition } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CodeEntry from '@/components/checkout/code-entry'
import { checkoutContent, giftCardFieldContent as content } from '@/data/checkout'
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

  // Render logic
  const chips =
    applied.length > 0 ? (
      <ul className="flex flex-col gap-2">
        {applied.map((c) => (
          <li key={c.code} className="flex items-center justify-between gap-3 text-[0.875rem]">
            <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-ck-summary-line px-3 py-1 font-medium">
              <CheckoutIcon name="gift" className="size-3.5" />
              <span className="truncate">
                {content.applied(c.lastCharacters)} · {content.balance(formatPaise(c.balancePaise))}
              </span>
            </span>
            <button
              type="button"
              onClick={() => onRemove(c.code)}
              disabled={pending}
              className="shrink-0 rounded-sm bg-transparent! p-0! text-[0.8125rem]! text-ck-summary-ink! underline underline-offset-4 opacity-70 outline-none hover:opacity-100 focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:opacity-40"
            >
              {content.remove}
            </button>
          </li>
        ))}
      </ul>
    ) : null

  return (
    <CodeEntry
      icon="gift"
      openLabel={checkoutContent.codes.giftCard}
      inputLabel={content.label}
      placeholder={content.placeholder}
      applyLabel={content.apply}
      code={code}
      pending={pending}
      error={error}
      chips={chips}
      onCode={setCode}
      onApply={handleApply}
    />
  )
}
