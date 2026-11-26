'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import LoyaltyCard from './loyalty-card'
import { forgetLoyaltyView, loadLoyaltyView } from './loyalty-client'
import LoyaltyCodesList from './loyalty-codes-list'
import LoyaltyEarnList from './loyalty-earn-list'
import LoyaltyGuestBody from './loyalty-guest-body'
import LoyaltyJoin from './loyalty-join'
import LoyaltyMemberBody from './loyalty-member-body'
import LoyaltyPanelHeader from './loyalty-panel-header'
import type { LoyaltyScreen } from './loyalty-points-card'
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

/** The home screen, or one of the lists the Points card opens. */
type Screen = 'home' | LoyaltyScreen

const SCREEN_TITLE: Record<LoyaltyScreen, string> = {
  earn: copy.earn.title,
  redeem: copy.rewards.redeemTitle,
  discounts: copy.codes.title,
}

/**
 * The header colour runs on behind the first card and fades to white, Essential Loyalty's look.
 * It is painted on the scrolling content (not the scroll box), so it scrolls with the header.
 */
const FADE =
  'bg-[linear-gradient(to_bottom,var(--kl-head-solid)_0,var(--kl-head-solid)_var(--kl-fade-at),var(--kl-surface)_calc(var(--kl-fade-at)+3rem))]'

/**
 * The rewards panel the launcher opens (loaded on the first open), Essential Loyalty's floating
 * card: 22.5rem by up to 40rem, 1.875rem from the corner, full screen on a phone (30rem and
 * narrower), or a full-height side panel when the embed says so. The header on the brand colour
 * fades into white behind white cards: the visitor view (Become a member, Points, referral) or the
 * member view (balance pill, Next reward, Points, referral, tier). Ways to earn, Ways to redeem
 * and My discounts open as their own screens with a back arrow; a visitor gets Join now pinned
 * at the bottom of them. Escape or a press outside closes it; focus moves into it on open.
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
  const panel = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const titleId = useId()
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
    panel.current?.focus({ preventScroll: true })
    const close = () => {
      setScreen('home')
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    // A press anywhere outside the widget (panel and its launcher) closes it, like Essential's.
    const onPointer = (e: PointerEvent) => {
      const widget = panel.current?.closest('.kl-loyalty') ?? panel.current
      if (widget && e.target instanceof Node && !widget.contains(e.target)) close()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, onClose])

  // Event handlers
  const handleRetry = () => {
    setLoad({ status: 'loading' })
    setAttempt((n) => n + 1)
  }
  const handleChanged = () => setAttempt((n) => n + 1)
  const handleOpen = (next: Screen) => {
    setScreen(next)
    scroller.current?.scrollTo({ top: 0 })
  }
  const handleHome = () => handleOpen('home')
  const handleClose = () => {
    setScreen('home')
    onClose()
  }

  // Render logic
  const left = settings.position === 'left'
  const frame =
    settings.layout === 'sidebar'
      ? `inset-y-0 w-[min(25rem,100vw)] ${left ? 'left-0' : 'right-0'}`
      : `bottom-[1.875rem] h-[min(40rem,calc(100dvh-3.75rem))] w-[22.5rem] rounded-[1.25rem] ${left ? 'left-[1.875rem]' : 'right-[1.875rem]'} max-[30rem]:inset-0 max-[30rem]:h-dvh max-[30rem]:w-full max-[30rem]:rounded-none`
  const view = load.status === 'ready' ? load.view : null
  const title = programTitle(settings, view?.storeName ?? storeName)
  const member = view?.member ?? null
  const guest = !!view && !member && !(signedIn && view.signedIn)
  const list = view && screen !== 'home' ? screen : null
  return (
    <section
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      hidden={!open}
      className={`fixed z-[2147483001] flex flex-col overflow-hidden bg-(--kl-surface) text-left text-[0.9375rem] normal-case leading-snug tracking-normal text-(--kl-ink) shadow-[0_0.3125rem_2.5rem_rgb(0_0_0/0.22)] outline-none ${frame}`}
    >
      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:none]"
      >
        <div
          className={`flex flex-col pb-4 ${FADE}`}
          style={{ ['--kl-fade-at' as string]: list ? '4rem' : member ? '9rem' : '8rem' }}
        >
          {list ? (
            <LoyaltyPanelHeader
              title={SCREEN_TITLE[list]}
              onBack={handleHome}
              onClose={handleClose}
              titleId={titleId}
            />
          ) : (
            <LoyaltyPanelHeader
              title={title}
              welcome={copy.welcome}
              balance={member ? member.points : undefined}
              onClose={handleClose}
              titleId={titleId}
            />
          )}
          <div className="flex flex-col gap-3.5 px-3.5">
            {list && view ? (
              list === 'earn' ? (
                <LoyaltyEarnList
                  ways={view.waysToEarn}
                  names={view.pointsName}
                  interactive={!!member}
                  onChanged={handleChanged}
                  heading={false}
                />
              ) : list === 'redeem' ? (
                <LoyaltyRewardList
                  title=""
                  rewards={view.rewards}
                  names={view.pointsName}
                  points={member ? member.points : null}
                  onClaimed={member ? handleChanged : null}
                />
              ) : (
                <LoyaltyCodesList codes={member?.codes ?? []} heading={false} />
              )
            ) : !view ? (
              <LoyaltyCard>
                {load.status === 'failed' ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <p className="m-0 text-(--kl-muted)">{copy.failed}</p>
                    <button
                      type="button"
                      onClick={handleRetry}
                      className="cursor-pointer rounded-[0.375rem]! border border-(--kl-line)! bg-transparent! px-4! py-2! font-semibold! text-(--kl-ink)!"
                    >
                      {copy.retry}
                    </button>
                  </div>
                ) : (
                  <p role="status" className="m-0 py-6 text-center text-(--kl-muted)">
                    {copy.loading}
                  </p>
                )}
              </LoyaltyCard>
            ) : !view.live && !view.open ? (
              <LoyaltyCard>
                <p className="m-0 py-4 text-center text-(--kl-muted)">{copy.paused}</p>
              </LoyaltyCard>
            ) : member ? (
              <LoyaltyMemberBody view={view} member={member} onOpen={handleOpen} />
            ) : !guest ? (
              <LoyaltyCard>
                <p className="m-0 py-4 text-center text-(--kl-muted)">{copy.notOpen}</p>
              </LoyaltyCard>
            ) : (
              <LoyaltyGuestBody view={view} onOpen={handleOpen} />
            )}
          </div>
        </div>
      </div>
      {list && guest ? (
        <div className="shrink-0 bg-(--kl-surface) px-4 pt-3 pb-5">
          <LoyaltyJoin />
        </div>
      ) : null}
    </section>
  )
}
