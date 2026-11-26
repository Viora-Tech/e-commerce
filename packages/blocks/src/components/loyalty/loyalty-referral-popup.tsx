'use client'

import { type CSSProperties, type FormEvent, useEffect, useId, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyClaimedCode from './loyalty-claimed-code'
import {
  claimReferral,
  LOYALTY_SIGNIN_EMAIL_KEY,
  loadLoyaltyView,
  type ReferralAnswer,
} from './loyalty-client'
import { offerLabel } from './loyalty-format'
import LoyaltyIcon from './loyalty-icon'
import { referralParam } from './loyalty-math'
import { loyaltyStyleVars, resolveLoyaltyWidgetSettings } from './loyalty-settings'
import { DARK_BUTTON, ICON_BUTTON } from './loyalty-styles'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyReferralPopupProps = {
  /** The embed's settings: header colours (the accent) and the optional headline. */
  settings: Record<string, unknown>
  /** The store's brand colour, the accent until the merchant picks a header colour. */
  brand?: string | null | undefined
  heading: string
  /** False in the theme editor's canvas: nothing is drawn. */
  live: boolean
}

const dismissKey = (code: string) => `kl-ref-closed-${code}`

const FIELD =
  'h-10 w-full rounded-[0.3125rem]! border border-(--kl-line)! bg-(--kl-surface)! px-3! text-[0.9375rem]! text-(--kl-ink)! shadow-none! outline-none focus:border-(--kl-accent)!'

function dismissed(code: string): boolean {
  try {
    return window.sessionStorage.getItem(dismissKey(code)) === '1'
  } catch {
    return false
  }
}

function remember(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    // Private mode: the shopper types it again.
  }
}

/**
 * The "Referral pop-up" embed, Essential Loyalty's centred card: a visitor who lands with a
 * member's link (`?ref=CODE`) sees "Friend invitation", the offer as the headline ("Get 10% off
 * your first order"), a line on how it works, Your name and Your email, and Claim reward. Claim
 * keeps the code; a signed-in shopper gets the welcome code at once (Copy, Apply), anyone else
 * goes to sign in with the email filled in (that makes the account) and comes back to the link.
 * Closed once, it stays closed for the visit.
 */
export default function LoyaltyReferralPopup({
  settings,
  brand,
  heading,
  live,
}: LoyaltyReferralPopupProps) {
  // Hooks
  const [code, setCode] = useState<string | null>(null)
  const [view, setView] = useState<LoyaltyView | null>(null)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<ReferralAnswer | null>(null)
  const [failed, setFailed] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const titleId = useId()
  useEffect(() => {
    if (!live) return
    const found = referralParam(window.location.search)
    if (!found || dismissed(found)) return
    setCode(found)
    void loadLoyaltyView().then(setView)
  }, [live])

  // Event handlers
  const handleClose = () => {
    if (code) remember(dismissKey(code), '1')
    setCode(null)
  }
  const handleClaim = async (e: FormEvent) => {
    e.preventDefault()
    if (!code) return
    setBusy(true)
    setFailed(false)
    const r = await claimReferral(code)
    setBusy(false)
    if (!r) {
      setFailed(true)
      return
    }
    if (r.status === 'signin') {
      if (email.trim()) remember(LOYALTY_SIGNIN_EMAIL_KEY, email.trim())
      const back = `${window.location.pathname}${window.location.search}`
      window.location.assign(`/account/login?return_to=${encodeURIComponent(back)}`)
      return
    }
    setAnswer(r)
  }

  // Early returns
  if (!code || !view?.live || !view.referral) return null
  if (answer?.status === 'off') return null

  // Render logic
  const s = resolveLoyaltyWidgetSettings(settings, brand)
  const offer = offerLabel(view.referral.friendReward, view.pointsName)
  const points = view.referral.friendReward.kind === 'points'
  const guest = !view.signedIn
  const ready = answer?.status === 'ready' && !!answer.code
  return (
    <div
      className="kl-loyalty fixed inset-0 z-[2147483002] flex items-center justify-center bg-black/50 p-4 font-sans normal-case tracking-normal"
      style={loyaltyStyleVars(s) as CSSProperties}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-full w-[min(25rem,100%)] flex-col gap-4 overflow-y-auto rounded-[1.25rem] bg-(--kl-surface) px-6 pt-12 pb-6 text-left text-[0.9375rem] text-(--kl-ink) shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label={copy.popup.close}
          className={`${ICON_BUTTON} absolute top-4 right-4 text-(--kl-ink)`}
        >
          <LoyaltyIcon name="close" className="size-5" />
        </button>
        <span className="text-[0.8125rem] font-medium tracking-wide text-(--kl-accent) uppercase">
          {copy.popup.label}
        </span>
        <h2
          id={titleId}
          className="m-0 font-[inherit] text-[1.625rem]! leading-tight! font-bold! tracking-normal! normal-case! text-(--kl-ink)!"
        >
          {heading || (points ? copy.popup.bodyPoints(offer) : copy.popup.headline(offer))}
        </h2>
        {ready && answer?.code ? (
          <>
            <p className="m-0 font-semibold">
              {name.trim() ? copy.popup.greeting(name.trim()) : copy.popup.done}
            </p>
            <LoyaltyClaimedCode
              redeemed={{
                id: code,
                title: offer,
                code: answer.code,
                expiresAt: null,
                rewardType: '',
              }}
              next="/cart"
            />
          </>
        ) : answer?.status === 'points' || answer?.status === 'ready' ? (
          <p className="m-0">{copy.popup.pointsDone}</p>
        ) : answer?.status === 'refused' ? (
          <p className="m-0 text-(--kl-muted)">{copy.popup.refused}</p>
        ) : (
          <form onSubmit={handleClaim} className="m-0 flex flex-col gap-3">
            <p className="m-0 text-[0.9375rem] leading-normal text-(--kl-muted)">
              {copy.popup.message}
            </p>
            {guest ? (
              <>
                <label className="flex flex-col gap-1.5 text-[0.875rem] text-(--kl-ink)">
                  {copy.popup.name}
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    className={FIELD}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[0.875rem] text-(--kl-ink)">
                  {copy.popup.email}
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    maxLength={200}
                    className={FIELD}
                  />
                </label>
              </>
            ) : null}
            <button type="submit" disabled={busy} className={`${DARK_BUTTON} mt-2 self-center`}>
              {busy ? copy.popup.claiming : copy.popup.claim}
            </button>
          </form>
        )}
        {failed ? (
          <p role="alert" className="m-0 text-[0.8125rem] text-(--kl-danger)">
            {copy.popup.failed}
          </p>
        ) : null}
      </div>
    </div>
  )
}
