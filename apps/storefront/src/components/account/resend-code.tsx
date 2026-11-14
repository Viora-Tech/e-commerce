'use client'

import { useEffect, useState } from 'react'
import { accountContent } from '@/data/account'
import { ACCOUNT_LINK } from '@/lib/account-classes'

type ResendCodeProps = {
  disabled: boolean
  onResend: () => void
  /** "Get it on WhatsApp": the same number by the store's other phone method, once the wait is over. */
  other?: { label: string; onSend: () => void } | null
}

const copy = accountContent.login

/** Seconds before another code may be asked for; the server refuses sooner ones anyway (tooSoon). */
const WAIT = 30

/**
 * "Resend code in 0:24", then "Send a new code" (Figma 948:15578). Keyed by the address, so a
 * new code (or a new address) starts the count again. The other channel waits for the same
 * count, since the server holds every new code for 30 seconds.
 */
export default function ResendCode({ disabled, onResend, other = null }: ResendCodeProps) {
  // Hooks
  const [left, setLeft] = useState(WAIT)

  useEffect(() => {
    if (left <= 0) return
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(t)
  }, [left])

  // Event handlers
  const handleResend = () => {
    onResend()
    setLeft(WAIT)
  }

  const handleOther = () => {
    other?.onSend()
    setLeft(WAIT)
  }

  // Render logic
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4">
      {left > 0 ? (
        <span className="text-[0.8125rem] text-ck-muted tabular-nums" aria-live="off">
          {copy.resendIn(left)}
        </span>
      ) : (
        <button type="button" className={ACCOUNT_LINK} onClick={handleResend} disabled={disabled}>
          {copy.resend}
        </button>
      )}
      {other && left <= 0 ? (
        <button type="button" className={ACCOUNT_LINK} onClick={handleOther} disabled={disabled}>
          {other.label}
        </button>
      ) : null}
    </div>
  )
}
