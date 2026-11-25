'use client'

import { useEffect, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import { forgetLoyaltyView, loadLoyaltyView } from './loyalty-client'
import LoyaltyEarnList from './loyalty-earn-list'
import LoyaltyGuestBody from './loyalty-guest-body'
import LoyaltyJoin from './loyalty-join'
import LoyaltyMemberBody from './loyalty-member-body'
import LoyaltyPanelHeader from './loyalty-panel-header'
import LoyaltyRewardList from './loyalty-reward-list'
import { type LoyaltyWidgetSettings, programTitle } from './loyalty-settings'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyPanelProps = {
  open: boolean
  settings: LoyaltyWidgetSettings
  storeName: string
  signedIn: boolean
  onClose: () => void
}

type Load = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; view: LoyaltyView }

/** The home screen, or one of the two lists the Points card opens. */
type Screen = 'home' | 'earn' | 'redeem'

/**
 * The rewards panel the launcher opens (loaded on the first open), laid out like Essential
 * Loyalty's: a gradient header in the merchant's colours ("Welcome to" over the program's name),
 * white cards overlapping its bottom edge, then the guest view (Become a member, Points with
 * Ways to earn / Ways to redeem, Refer a friend's Give / Get) or the member view (balance,
 * Points, tier, Your rewards, referral). Ways to earn and Ways to redeem open as their own screens with a back arrow;
 * a guest gets Join now pinned under them. A pop-up above the launcher or a full-height side
 * panel, as the embed settings say. Escape closes it.
 */
export default function LoyaltyPanel({
  open,
  settings,
  storeName,
  signedIn,
  onClose,
}: LoyaltyPanelProps) {
  // Hooks
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [screen, setScreen] = useState<Screen>('home')
  useEffect(() => {
    if (!open) return
    let live = true
    // A retry or a change (a claim, a click-through) asks the store again.
    if (attempt > 0) forgetLoyaltyView()
    void loadLoyaltyView().then((view) => {
      if (live) setLoad(view ? { status: 'ready', view } : { status: 'failed' })
    })
    return () => {
      live = false
    }
  }, [open, attempt])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setScreen('home')
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Event handlers
  const handleRetry = () => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }
  const handleChanged = () => setAttempt((n) => n + 1)
  const handleHome = () => setScreen('home')
  const handleClose = () => {
    setScreen('home')
    onClose()
  }

  // Render logic
  const left = settings.position === 'left'
  const frame =
    settings.layout === 'sidebar'
      ? `inset-y-0 w-[min(25rem,100vw)] ${left ? 'left-0' : 'right-0'}`
      : `bottom-20 max-h-[min(42rem,calc(100dvh-6.5rem))] w-[min(23rem,calc(100vw-2rem))] rounded-2xl ${left ? 'left-4' : 'right-4'}`
  const view = load.status === 'ready' ? load.view : null
  const title = programTitle(settings, view?.storeName ?? storeName)
  const member = view?.member ?? null
  const guest = !!view && !member && !(signedIn && view.signedIn)
  const list = view && screen !== 'home' ? screen : null
  return (
    <section
      aria-label={title}
      hidden={!open}
      className={`fixed z-[2147483001] flex flex-col overflow-hidden border border-(--kl-line) bg-(--kl-soft) text-left text-[0.9375rem] normal-case leading-snug tracking-normal text-(--kl-ink) shadow-2xl ${frame}`}
    >
      {list && view ? (
        <>
          <LoyaltyPanelHeader
            title={list === 'earn' ? copy.earn.title : copy.rewards.redeemTitle}
            onBack={handleHome}
            onClose={handleClose}
          />
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4">
            {list === 'earn' ? (
              <LoyaltyEarnList
                ways={view.waysToEarn}
                names={view.pointsName}
                interactive={!!member}
                onChanged={handleChanged}
                heading={false}
              />
            ) : (
              <LoyaltyRewardList
                title=""
                rewards={view.rewards}
                names={view.pointsName}
                points={member ? member.points : null}
                onClaimed={member ? handleChanged : null}
              />
            )}
          </div>
          {guest ? (
            <footer className="border-t border-(--kl-line) bg-(--kl-surface) p-4">
              <LoyaltyJoin />
            </footer>
          ) : null}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <LoyaltyPanelHeader
            title={title}
            welcome={member ? copy.welcomeBack : copy.welcome}
            storeName={view?.storeName || storeName}
            onClose={handleClose}
          />
          <div className="relative -mt-11 flex flex-col gap-3 px-4 pb-5">
            {!view ? (
              <LoyaltyCard>
                {load.status === 'failed' ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <p className="m-0 text-(--kl-muted)">{copy.failed}</p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="rounded-full border border-(--kl-line) bg-transparent px-4 py-2 font-semibold text-(--kl-ink)"
                    >
                      {copy.retry}
                    </button>
                  </div>
                ) : (
                  <p role="status" className="m-0 py-4 text-center text-(--kl-muted)">
                    {copy.loading}
                  </p>
                )}
              </LoyaltyCard>
            ) : !view.live && !view.open ? (
              <LoyaltyCard>
                <p className="m-0 py-4 text-center text-(--kl-muted)">{copy.paused}</p>
              </LoyaltyCard>
            ) : member ? (
              <LoyaltyMemberBody view={view} member={member} onOpen={setScreen} />
            ) : !guest ? (
              <LoyaltyCard>
                <p className="m-0 py-4 text-center text-(--kl-muted)">{copy.notOpen}</p>
              </LoyaltyCard>
            ) : (
              <LoyaltyGuestBody view={view} onOpen={setScreen} />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
