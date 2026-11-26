'use client'

import { useEffect, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { ACCENT_LINK, DARK_BUTTON } from './loyalty-styles'

type LoyaltyJoinProps = {
  /** Where sign-in comes back to; empty: this page (read after mount, so it renders on the server). */
  returnTo?: string | undefined
}

const signInHref = (back: string) => `/account/login?return_to=${encodeURIComponent(back)}`

/**
 * "Join now" (near-black) and "Already have an account? Sign in" (brand colour), centred: both go
 * to the store's sign-in, which creates the account (and the membership) on the way and comes
 * back to this page.
 */
export default function LoyaltyJoin({ returnTo = '' }: LoyaltyJoinProps) {
  // Hooks
  const [here, setHere] = useState(returnTo || '/')
  useEffect(() => {
    if (!returnTo) setHere(`${window.location.pathname}${window.location.search}`)
  }, [returnTo])

  // Render logic
  const href = signInHref(here)
  return (
    <div className="flex flex-col items-center gap-3">
      <a href={href} className={DARK_BUTTON}>
        {copy.guest.join}
      </a>
      <p className="m-0 text-center text-[0.875rem] text-(--kl-muted)">
        {copy.guest.haveAccount}{' '}
        <a href={href} className={ACCENT_LINK}>
          {copy.guest.signIn}
        </a>
      </p>
    </div>
  )
}
