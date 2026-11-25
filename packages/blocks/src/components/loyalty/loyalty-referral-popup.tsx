'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import Icon from '../icon'
import LoyaltyClaimedCode from './loyalty-claimed-code'
import { claimReferral, loadLoyaltyView, type ReferralAnswer } from './loyalty-client'
import { offerLabel } from './loyalty-format'
import { referralParam } from './loyalty-math'
import { loyaltyStyleVars, resolveLoyaltyWidgetSettings } from './loyalty-settings'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyReferralPopupProps = {
  /** The embed's settings: header colours and the optional heading. */
  settings: Record<string, unknown>
  heading: string
  /** False in the theme editor's canvas: nothing is drawn. */
  live: boolean
}

const dismissKey = (code: string) => `kl-ref-closed-${code}`

function dismissed(code: string): boolean {
  try {
    return window.sessionStorage.getItem(dismissKey(code)) === '1'
  } catch {
    return false
  }
}

/**
 * The "Referral pop-up" embed: a visitor who lands with a member's link (`?ref=CODE`) sees the
 * friend's offer. "Get my reward" keeps the code; a signed-in shopper gets the welcome code at
 * once (Copy, Apply at checkout), anyone else signs in first (that makes the account) and comes
 * back to the same link. Closed once, it stays closed for the visit.
 */
export default function LoyaltyReferralPopup({
  settings,
  heading,
  live,
}: LoyaltyReferralPopupProps) {
  // Hooks
  const [code, setCode] = useState<string | null>(null)
  const [view, setView] = useState<LoyaltyView | null>(null)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<ReferralAnswer | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!live) return
    const found = referralParam(window.location.search)
    if (!found || dismissed(found)) return
    setCode(found)
    void loadLoyaltyView().then(setView)
  }, [live])

  // Event handlers
  const handleClose = () => {
    if (code) {
      try {
        window.sessionStorage.setItem(dismissKey(code), '1')
      } catch {
        // Private mode: it shows again on the next page with the link.
      }
    }
    setCode(null)
  }
  const handleClaim = async () => {
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
  const s = resolveLoyaltyWidgetSettings(settings)
  const offer = offerLabel(view.referral.friendReward, view.pointsName)
  const points = view.referral.friendReward.kind === 'points'
  return (
    <div
      className="kl-loyalty fixed inset-0 z-[2147483002] flex items-center justify-center bg-black/50 p-4 font-sans normal-case tracking-normal"
      style={loyaltyStyleVars(s) as CSSProperties}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading || copy.popup.heading}
        className="flex w-[min(24rem,100%)] flex-col overflow-hidden rounded-2xl bg-(--kl-surface) text-left text-[0.9375rem] text-(--kl-ink) shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 bg-(image:--kl-head) bg-(--kl-head-solid) px-5 py-4 text-(--kl-head-text)">
          <span className="text-[1.125rem] font-bold leading-tight">
            {heading || copy.popup.heading}
          </span>
          <button
            type="button"
            onClick={handleClose}
            aria-label={copy.popup.close}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-(--kl-head-text)"
          >
            <Icon name="close" size={14} />
          </button>
        </header>
        <div className="flex flex-col gap-3 p-5">
          {answer?.status === 'ready' && answer.code ? (
            <>
              <p className="m-0 font-semibold">{copy.popup.done}</p>
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
          ) : answer?.status === 'points' || (answer?.status === 'ready' && !answer.code) ? (
            <p className="m-0">{copy.popup.pointsDone}</p>
          ) : answer?.status === 'refused' ? (
            <p className="m-0 text-(--kl-muted)">{copy.popup.refused}</p>
          ) : (
            <>
              <p className="m-0">
                {points ? copy.popup.bodyPoints(offer) : copy.popup.body(offer)}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={handleClaim}
                className="inline-flex h-11 items-center justify-center rounded-full border-0 bg-(image:--kl-head) bg-(--kl-head-solid) px-5 font-semibold text-(--kl-head-text) disabled:opacity-60"
              >
                {busy ? copy.popup.claiming : copy.popup.claim}
              </button>
              {view.signedIn ? null : (
                <p className="m-0 text-center text-[0.8125rem] text-(--kl-muted)">
                  {copy.popup.signIn}
                </p>
              )}
            </>
          )}
          {failed ? (
            <p role="alert" className="m-0 text-[0.8125rem] text-(--kl-danger)">
              {copy.popup.failed}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
