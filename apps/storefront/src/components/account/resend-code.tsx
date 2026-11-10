'use client'

import { useEffect, useState } from 'react'
import { accountContent } from '@/data/account'

type ResendCodeProps = {
  disabled: boolean
  onResend: () => void
}

const copy = accountContent.login

/** Seconds before another code may be asked for; the server refuses sooner ones anyway (tooSoon). */
const WAIT = 30

/**
 * "Send a new code", counting down first (Figma 948:15578). Keyed by the address, so a new
 * code (or a new address) starts the count again.
 */
export default function ResendCode({ disabled, onResend }: ResendCodeProps) {
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

  // Render logic
  return left > 0 ? (
    <span className="text-muted tabular-nums">{copy.resendIn(left)}</span>
  ) : (
    <button
      type="button"
      className="underline underline-offset-4 disabled:opacity-50"
      onClick={handleResend}
      disabled={disabled}
    >
      {copy.resend}
    </button>
  )
}
