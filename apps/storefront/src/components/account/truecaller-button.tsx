'use client'

import { useEffect, useRef, useState } from 'react'
import { accountContent } from '@/data/account'
import { pollTruecallerAction, startTruecallerAction } from '@/lib/login-actions'

type TruecallerButtonProps = {
  returnTo: string
  remember: boolean
}

type Phase = 'idle' | 'starting' | 'waiting' | 'missing' | 'failed'

const copy = accountContent.login
/** If the page still has focus this long after the deep link, Truecaller did not open. */
const OPEN_CHECK_MS = 700
const POLL_MS = 3000
/** Truecaller's request lives ten minutes; stop asking well before. */
const MAX_POLLS = 40

/**
 * "Continue with Truecaller" (Android, Truecaller app installed): opens Truecaller's
 * sheet, then asks our server every few seconds whether Truecaller confirmed the number.
 */
export default function TruecallerButton({ returnTo, remember }: TruecallerButtonProps) {
  // Hooks
  const [phase, setPhase] = useState<Phase>('idle')
  const polls = useRef(0)

  useEffect(() => {
    if (phase !== 'waiting') return
    const timer = window.setInterval(async () => {
      polls.current += 1
      const r = await pollTruecallerAction()
      if (r.state === 'ready') {
        window.clearInterval(timer)
        window.location.assign(r.next)
      } else if (r.state === 'failed' || polls.current >= MAX_POLLS) {
        window.clearInterval(timer)
        setPhase('failed')
      }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [phase])

  // Event handlers
  const handleClick = async () => {
    setPhase('starting')
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

  // Render logic
  const busy = phase === 'starting' || phase === 'waiting'
  const message =
    phase === 'missing' ? copy.truecallerMissing : phase === 'failed' ? copy.truecallerFailed : null

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
