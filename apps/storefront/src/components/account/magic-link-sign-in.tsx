'use client'

import { useEffect, useState, useTransition } from 'react'
import AccountError from '@/components/account/account-error'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent } from '@/data/account'
import { ACCOUNT_TITLE } from '@/lib/account-classes'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY, CK_CARD, CK_LIFT } from '@/lib/checkout-classes'
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
    <div
      className={`mx-auto! flex w-full max-w-[27.5rem] flex-col gap-5 p-5 sm:p-6 ${CK_CARD} ${CK_LIFT}`}
    >
      <h1 className={ACCOUNT_TITLE}>{copy.title}</h1>
      {message ? (
        <AccountError message={message} />
      ) : (
        <p className="text-[0.9375rem] text-ck-muted">{copy.intro}</p>
      )}
      {token && !error ? (
        <button
          type="button"
          className={CK_BUTTON_PRIMARY}
          onClick={handleClick}
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? (
            <CheckoutIcon
              name="spinner"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {pending ? copy.working : copy.button}
        </button>
      ) : (
        <a className={`${CK_BUTTON_SECONDARY} h-12! w-full`} href="/account/login">
          {copy.again}
        </a>
      )}
    </div>
  )
}
