'use client'

import { startAuthentication } from '@simplewebauthn/browser'
import { useState, useTransition } from 'react'
import { accountContent } from '@/data/account'
import { passkeyLoginOptionsAction, passkeySignInAction } from '@/lib/login-actions'

type PasskeyButtonProps = {
  returnTo: string
  remember: boolean
  /** The checkout's own button look; the theme's by default. */
  buttonClassName?: string
}

const copy = accountContent.login

/** "Sign in with a passkey": the browser offers the passkeys saved for this shop. */
export default function PasskeyButton({ returnTo, remember, buttonClassName }: PasskeyButtonProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleClick = () => {
    setError(null)
    start(async () => {
      const options = await passkeyLoginOptionsAction()
      if (!options) {
        setError(copy.errors.unavailable)
        return
      }
      let response: unknown
      try {
        response = await startAuthentication({ optionsJSON: options })
      } catch {
        // Cancelled, or no passkey for this shop on this device.
        setError(copy.errors.passkeyFailed)
        return
      }
      const r = await passkeySignInAction(response, returnTo, remember)
      if (r && !r.ok) setError(r.error ?? copy.errors.passkeyFailed)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className={buttonClassName ?? `btn btn--secondary w-full${pending ? ' is-loading' : ''}`}
        onClick={handleClick}
        disabled={pending}
      >
        <span className="btn__label">{pending ? copy.passkeyWorking : copy.passkey}</span>
      </button>
      {error ? (
        <p className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
