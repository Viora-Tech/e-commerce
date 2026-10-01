'use client'

import { useEffect, useRef, useState } from 'react'
import { accountContent } from '@/data/account'
import {
  confirmTruecallerCodeAction,
  pollTruecallerAction,
  startTruecallerAction,
} from '@/lib/login-actions'

type TruecallerButtonProps = {
  returnTo: string
  remember: boolean
}

type Phase = 'idle' | 'starting' | 'waiting' | 'missing' | 'failed' | 'code' | 'checking'

const copy = accountContent.login
/** If the page still has focus this long after the deep link, Truecaller did not open. */
const OPEN_CHECK_MS = 700
const POLL_MS = 3000
/** Truecaller's request lives ten minutes; stop asking well before. */
const MAX_POLLS = 40

/**
 * "Continue with Truecaller" (Android, Truecaller app installed): opens Truecaller's
 * sheet, then asks our server every few seconds whether Truecaller confirmed the number.
 * When the number already belongs to an account here, the shopper also types the code we
 * sent to that number before they are signed in (security audit D-03).
 */
export default function TruecallerButton({ returnTo, remember }: TruecallerButtonProps) {
  // Hooks
  const [phase, setPhase] = useState<Phase>('idle')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const polls = useRef(0)

  useEffect(() => {
    if (phase !== 'waiting') return
    const timer = window.setInterval(async () => {
      polls.current += 1
      const r = await pollTruecallerAction()
      if (r.state === 'ready') {
        window.clearInterval(timer)
        window.location.assign(r.next)
      } else if (r.state === 'verify_phone') {
        window.clearInterval(timer)
        setPhase('code')
      } else if (r.state === 'failed' || polls.current >= MAX_POLLS) {
        window.clearInterval(timer)
        setError(r.state === 'failed' ? (r.error ?? null) : null)
        setPhase('failed')
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [phase])

  // Event handlers
  const handleClick = async () => {
    setPhase('starting')
    setError(null)
    polls.current = 0
    const r = await startTruecallerAction(returnTo, remember)
    if (!r.ok) {
      setPhase('failed')
      return
    }
    window.location.href = r.link
    window.setTimeout(() => {
      setPhase(document.hasFocus() ? 'missing' : 'waiting')
    }, OPEN_CHECK_MS)
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhase('checking')
    const r = await confirmTruecallerCodeAction(code)
    if (r.state === 'ready') {
      window.location.assign(r.next)
      return
    }
    setError(r.state === 'verify_phone' || r.state === 'failed' ? (r.error ?? null) : null)
    setPhase(r.state === 'verify_phone' ? 'code' : 'failed')
  }

  // Early returns
  if (phase === 'code' || phase === 'checking') {
    return (
      <form className="flex flex-col gap-2" onSubmit={handleCodeSubmit}>
        <p className="text-body font-semibold">{copy.truecallerCodeTitle}</p>
        <p className="text-small text-muted">{copy.truecallerCodeIntro}</p>
        <label className="flex flex-col gap-1 text-small">
          {copy.code}
          <input
            className="field__input text-center tracking-[0.5em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <button
          type="submit"
          className={`btn btn--primary w-full${phase === 'checking' ? ' is-loading' : ''}`}
          disabled={phase === 'checking' || code.length !== 6}
        >
          <span className="btn__label">{phase === 'checking' ? copy.verifying : copy.verify}</span>
        </button>
        {error ? (
          <p className="text-small text-muted" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    )
  }

  // Render logic
  const busy = phase === 'starting' || phase === 'waiting'
  const message =
    phase === 'missing'
      ? copy.truecallerMissing
      : phase === 'failed'
        ? (error ?? copy.truecallerFailed)
        : null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={`btn btn--secondary w-full${busy ? ' is-loading' : ''}`}
        onClick={handleClick}
        disabled={busy}
      >
        <span className="btn__label">
          {phase === 'waiting' ? copy.truecallerWaiting : copy.providers.truecaller}
        </span>
      </button>
      {message ? (
        <p className="text-small text-muted" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
