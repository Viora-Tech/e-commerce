'use client'

import { useEffect, useRef, useState } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { manualPaymentContent as content } from '@/data/checkout'

type CopyButtonProps = {
  value: string
  /** What is copied, for screen readers ("UPI ID"). */
  label: string
}

/** How long "Copied" stays before the button goes back. */
const COPIED_MS = 1600

/** A small Copy action beside a payment detail; says Copied for a moment once it worked. */
export default function CopyButton({ value, label }: CopyButtonProps) {
  // Hooks
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  // Event handlers
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      return
    }
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
  }

  // Render logic
  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={content.copyLabel(label)}
      className="relative flex shrink-0 cursor-pointer items-center gap-1 bg-transparent! p-0! text-[0.75rem] font-medium text-ck-muted outline-none transition-colors duration-150 after:absolute after:-inset-3 hover:text-ck-ink focus-visible:text-ck-ink"
    >
      <CheckoutIcon name={copied ? 'check' : 'copy'} className="size-3.5" />
      <span aria-live="polite">{copied ? content.copied : content.copy}</span>
    </button>
  )
}
