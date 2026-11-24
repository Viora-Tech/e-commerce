'use client'

import { useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { applyLoyaltyCode } from './loyalty-client'
import { dayLabel } from './loyalty-format'
import type { LoyaltyRedeemed } from './loyalty-types'

type LoyaltyClaimedCodeProps = {
  redeemed: LoyaltyRedeemed
  /** Where "Apply at checkout" goes once the code is on the cart. */
  next?: string | undefined
}

/**
 * A reward just claimed: the code with Copy and "Apply at checkout" (puts the code on the cart,
 * then opens checkout), or, for store credit, where the money went.
 */
export default function LoyaltyClaimedCode({
  redeemed,
  next = '/checkout',
}: LoyaltyClaimedCodeProps) {
  // Hooks
  const [copied, setCopied] = useState(false)
  const [applying, setApplying] = useState(false)
  const [failed, setFailed] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    if (!redeemed.code) return
    try {
      await navigator.clipboard.writeText(redeemed.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  const handleApply = async () => {
    if (!redeemed.code) return
    setApplying(true)
    const r = await applyLoyaltyCode(redeemed.code)
    if (r?.ok) {
      window.location.assign(next)
      return
    }
    setApplying(false)
    setFailed(true)
  }

  // Early returns
  if (!redeemed.code) {
    return (
      <p role="status" className="m-0 rounded-lg bg-(--kl-soft) p-3 text-(--kl-ink)">
        {copy.code.credit}
      </p>
    )
  }

  // Render logic
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg bg-(--kl-soft) p-3">
      <span className="text-[0.8125rem] text-(--kl-muted)">
        {copy.code.yourCode} · {redeemed.title}
      </span>
      <span className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-dashed border-(--kl-line) bg-(--kl-surface) px-3 py-2 font-mono text-[0.9375rem] font-bold text-(--kl-ink)">
          {redeemed.code}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-full border border-(--kl-line) bg-(--kl-surface) px-3 py-2 text-[0.8125rem] font-semibold text-(--kl-ink)"
        >
          {copied ? copy.code.copied : copy.code.copy}
        </button>
      </span>
      <button
        type="button"
        disabled={applying}
        onClick={handleApply}
        className="inline-flex h-10 items-center justify-center rounded-full border-0 bg-(image:--kl-head) bg-(--kl-head-solid) px-4 text-[0.875rem] font-semibold text-(--kl-head-text) disabled:opacity-60"
      >
        {applying ? copy.code.applying : copy.code.apply}
      </button>
      {redeemed.expiresAt ? (
        <span className="text-[0.8125rem] text-(--kl-muted)">
          {copy.code.until(dayLabel(redeemed.expiresAt))}
        </span>
      ) : null}
      {failed ? (
        <span role="alert" className="text-[0.8125rem] text-(--kl-danger)">
          {copy.code.applyFailed}
        </span>
      ) : null}
    </div>
  )
}
