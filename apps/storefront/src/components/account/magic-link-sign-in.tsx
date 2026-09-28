'use client'

import { useEffect, useState, useTransition } from 'react'
import { accountContent } from '@/data/account'
import { redeemMagicLinkAction } from '@/lib/login-actions'

type MagicLinkSignInProps = {
  /** The link's token, or null when it has expired or was used. */
  token: string | null
}

const copy = accountContent.login.link

/** One button that spends the emailed link and signs this device in. */
export default function MagicLinkSignIn({ token }: MagicLinkSignInProps) {
  // Hooks
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    // The token stays in this component only; the address bar (and anything that reads
    // it later: history, extensions, a shared screenshot) no longer shows it.
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  // Event handlers
  const handleClick = () => {
    if (!token) return
    setError(null)
    start(async () => {
      const r = await redeemMagicLinkAction(token)
      if (r && !r.ok) setError(r.error ?? copy.invalid)
    })
  }

  // Render logic
  const message = token ? error : copy.invalid

  return (
    <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-5 rounded-2xl border border-line p-6 md:p-8">
      <h1 className="h3">{copy.title}</h1>
      {message ? (
        <p className="text-body text-danger" role="alert">
          {message}
        </p>
      ) : (
        <p className="text-body text-muted">{copy.intro}</p>
      )}
      {token && !error ? (
        <button
          type="button"
          className={`btn btn--primary w-full${pending ? ' is-loading' : ''}`}
          onClick={handleClick}
          disabled={pending}
        >
          <span className="btn__label">{pending ? copy.working : copy.button}</span>
        </button>
      ) : (
        <a className="btn btn--secondary w-full" href="/account/login">
          <span className="btn__label">{copy.again}</span>
        </a>
      )}
    </div>
  )
}
