'use client'

import { useEffect, useState } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import Icon from '../icon'
import { forgetLoyaltyView, loadLoyaltyView } from './loyalty-client'
import LoyaltyGuestBody from './loyalty-guest-body'
import LoyaltyMemberBody from './loyalty-member-body'
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

/**
 * The rewards panel the launcher opens (loaded on the first open): the program's name in the
 * merchant's header colours, then the guest view (join, ways to earn and redeem, referral
 * teaser) or the member view (points, tier, rewards, codes, ways to earn, referral). A pop-up
 * above the launcher or a full-height side panel, as the embed settings say. Escape closes it.
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
      if (e.key === 'Escape') onClose()
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

  // Render logic
  const left = settings.position === 'left'
  const frame =
    settings.layout === 'sidebar'
      ? `inset-y-0 w-[min(25rem,100vw)] ${left ? 'left-0' : 'right-0'}`
      : `bottom-20 max-h-[min(42rem,calc(100dvh-6.5rem))] w-[min(23rem,calc(100vw-2rem))] rounded-2xl ${left ? 'left-4' : 'right-4'}`
  const title = programTitle(settings, load.status === 'ready' ? load.view.storeName : storeName)
  return (
    <section
      aria-label={title}
      hidden={!open}
      className={`fixed z-[2147483001] flex flex-col overflow-hidden border border-(--kl-line) bg-(--kl-surface) text-left text-[0.9375rem] normal-case leading-snug tracking-normal text-(--kl-ink) shadow-2xl ${frame}`}
    >
      <header className="flex items-start justify-between gap-3 bg-(image:--kl-head) bg-(--kl-head-solid) px-5 py-4 text-(--kl-head-text)">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-[1.125rem] font-bold leading-tight">{title}</span>
          {load.status === 'ready' && load.view.member ? (
            <span className="text-[0.875rem] opacity-90">
              {copy.points(load.view.member.points, load.view.pointsName)}
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.close}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-(--kl-head-text) hover:bg-white/15"
        >
          <Icon name="close" size={14} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
        {load.status === 'loading' ? (
          <p role="status" className="py-6 text-center text-(--kl-muted)">
            {copy.loading}
          </p>
        ) : load.status === 'failed' ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="m-0 text-(--kl-muted)">{copy.failed}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-full border border-(--kl-line) bg-transparent px-4 py-2 font-semibold text-(--kl-ink)"
            >
              {copy.retry}
            </button>
          </div>
        ) : !load.view.live && !load.view.open ? (
          <p className="py-6 text-center text-(--kl-muted)">{copy.paused}</p>
        ) : load.view.member ? (
          <LoyaltyMemberBody view={load.view} member={load.view.member} onChanged={handleChanged} />
        ) : signedIn && load.view.signedIn ? (
          <p className="py-6 text-center text-(--kl-muted)">{copy.notOpen}</p>
        ) : (
          <LoyaltyGuestBody view={load.view} />
        )}
      </div>
    </section>
  )
}
