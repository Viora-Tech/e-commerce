'use client'

import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { ACCENT_BUTTON } from './loyalty-styles'

/** Sign-in path that comes back to this page. */
function signInHref(): string {
  const here = `${window.location.pathname}${window.location.search}`
  return `/account/login?return_to=${encodeURIComponent(here)}`
}

/**
 * "Join now" (in the merchant's colour) and "Already have an account? Sign in" for a visitor:
 * both go to the store's sign-in, which creates the account (and the membership) on the way.
 */
export default function LoyaltyJoin() {
  // Render logic
  const href = signInHref()
  return (
    <div className="flex flex-col gap-2">
      <a href={href} className={ACCENT_BUTTON}>
        {copy.guest.join}
      </a>
      <p className="m-0 text-center text-[0.875rem] text-(--kl-muted)">
        {copy.guest.haveAccount}{' '}
        <a href={href} className="font-semibold text-(--kl-ink) underline">
          {copy.guest.signIn}
        </a>
      </p>
    </div>
  )
}
