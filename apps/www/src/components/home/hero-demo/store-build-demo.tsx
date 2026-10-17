'use client'

import { useEffect, useRef, useState } from 'react'
import { buildDemoStore, demoStoreContent as copy } from '@/data/demo-store'
import { ctaClass } from '@/lib/cta'
import { loadGsap, prefersReducedMotion } from '@/lib/gsap'
import { useWaitlist } from '../../waitlist/waitlist-context'
import { useHeroDemo } from './hero-demo-context'
import OrderArcs, { type ArcPoint } from './order-arcs'
import StorefrontCard from './storefront-card'

type ArcSet = { key: number; origins: ArcPoint[]; target: { x: number; y: number } }

const MAX_ARCS = 8
const RELEASE_AFTER_MS = 5000

/**
 * "AI builds your store", about five seconds: the globe turns to India, order arcs shoot from the
 * city pins into one point beside the headline, the storefront assembles block by block with the
 * name, tile and three products taken from what was typed, then the UPI, GST and courier notices
 * arrive and the "Start this store" button appears. Skippable. With reduced motion it shows the
 * finished state with no sequence. Everything here is DEMO data (`data/demo-store.ts`).
 */
export default function StoreBuildDemo() {
  // Hooks
  const { phase, text, runId, skip, skipId, finish, reducedMotion, sectionRef, globeApiRef } =
    useHeroDemo()
  const { openWaitlist } = useWaitlist()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<{ progress: (value: number) => unknown; kill: () => void } | null>(
    null,
  )
  const [arcs, setArcs] = useState<ArcSet | null>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (runId === 0 || !wrapper || reducedMotion || prefersReducedMotion()) return
    let cancelled = false
    let releaseTimer: ReturnType<typeof setTimeout> | undefined
    setArcs(null)
    loadGsap().then(({ gsap }) => {
      if (cancelled) return
      const card = wrapper.querySelector('[data-card]')
      const blocks = wrapper.querySelectorAll('[data-block]')
      const notices = wrapper.querySelectorAll('[data-notice]')
      const cta = wrapper.querySelector('[data-cta]')
      const ticks = wrapper.querySelectorAll('[data-tick]')
      gsap.set([card, blocks, notices, cta, ticks], { clearProps: 'all' })
      gsap.set(card, { opacity: 0, scale: 0.94, y: 24 })
      gsap.set(blocks, { opacity: 0, y: 14, filter: 'blur(4px)' })
      gsap.set(notices, { opacity: 0, x: 48 })
      gsap.set(ticks, { scale: 0 })
      gsap.set(cta, { opacity: 0, y: 12 })

      globeApiRef.current?.focusIndia()
      const emitArcs = () => {
        const hero = sectionRef.current
        const pins = globeApiRef.current?.visiblePins() ?? []
        if (!hero || pins.length === 0) return
        const box = hero.getBoundingClientRect()
        const cardBox = (card ?? wrapper).getBoundingClientRect()
        const wide = window.matchMedia('(min-width: 1280px)').matches
        const target = {
          x: (wide ? cardBox.left : cardBox.left + cardBox.width / 2) - box.left,
          y: (wide ? cardBox.top + cardBox.height / 3 : cardBox.top) - box.top,
        }
        const step = Math.max(1, Math.floor(pins.length / MAX_ARCS))
        const origins = pins
          .filter((_, index) => index % step === 0)
          .slice(0, MAX_ARCS)
          .map((pin) => ({ id: pin.id, x: pin.x - box.left, y: pin.y - box.top }))
        setArcs({ key: runId, origins, target })
      }

      const timeline = gsap.timeline({
        onComplete: () => {
          gsap.set([card, blocks, notices, cta, ticks], { clearProps: 'all' })
          setArcs(null)
          finish()
          releaseTimer = setTimeout(() => globeApiRef.current?.release(), RELEASE_AFTER_MS)
        },
      })
      timelineRef.current = timeline
      timeline
        .call(emitArcs, [], 1.1)
        .to(card, { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'expo.out' }, 1.7)
        .to(
          blocks,
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.5,
            ease: 'power3.out',
            stagger: 0.16,
          },
          1.9,
        )
        .to(notices[0] ?? null, { opacity: 1, x: 0, duration: 0.6, ease: 'back.out(1.4)' }, 3.4)
        .to(notices[1] ?? null, { opacity: 1, x: 0, duration: 0.6, ease: 'back.out(1.4)' }, 3.8)
        .to(ticks, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, 4.2)
        .to(notices[2] ?? null, { opacity: 1, x: 0, duration: 0.6, ease: 'back.out(1.4)' }, 4.3)
        .to(cta, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, 4.8)
    })
    return () => {
      cancelled = true
      timelineRef.current?.kill()
      timelineRef.current = null
      clearTimeout(releaseTimer)
    }
  }, [runId, reducedMotion, finish, sectionRef, globeApiRef])

  useEffect(() => {
    if (skipId > 0) timelineRef.current?.progress(1)
  }, [skipId])

  // Render logic
  const store = buildDemoStore(text || 'handmade jewellery from Jaipur')
  if (runId === 0 && !reducedMotion) return null

  return (
    <>
      {arcs ? <OrderArcs key={arcs.key} origins={arcs.origins} target={arcs.target} /> : null}
      <div
        ref={wrapperRef}
        data-armed={phase === 'running' && !reducedMotion}
        className="group/demo absolute top-[34rem] left-1/2 z-20 w-[16.5rem] [translate:-50%_0] xl:top-[9rem] xl:right-[max(2rem,calc(50%-39.5rem))] xl:left-auto xl:[translate:0_0]"
      >
        {phase === 'running' && !reducedMotion ? (
          <button
            type="button"
            onClick={skip}
            className="absolute -top-7 right-0 rounded-md px-2 py-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {copy.skip}
          </button>
        ) : null}
        <StorefrontCard store={store} />
        <div
          data-cta
          className="mt-3 flex flex-col items-center gap-2 group-data-[armed=true]/demo:opacity-0"
        >
          <button
            type="button"
            className={ctaClass('md', 'w-full')}
            onClick={() => openWaitlist({ sell: text })}
          >
            {copy.startStore} →
          </button>
          <p className="text-[0.6875rem] text-muted-foreground">{copy.demoNote}</p>
        </div>
      </div>
    </>
  )
}
