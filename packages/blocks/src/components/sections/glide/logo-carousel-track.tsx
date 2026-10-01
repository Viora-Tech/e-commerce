'use client'

import { type ReactNode, useEffect, useRef } from 'react'
import { MARQUEE } from '../../../data/glide/logo-carousel'

type LogoCarouselTrackProps = { scrollReactive: boolean; children: ReactNode }

const REDUCED = '(prefers-reduced-motion: reduce)'

/** Sets the running CSS animation's speed without moving the strip (seamless rate change). */
function setPlaybackRate(el: HTMLElement, value: number) {
  for (const animation of el.getAnimations()) animation.updatePlaybackRate(value)
}

// Port of assets/marquee-motion.js for one track. The marquee itself is pure CSS (two identical
// runs scrolled by -50%); this only adds, on top, (1) pausing while the row is off screen and
// (2) a speed that follows how fast the page scrolls. With no script, or under reduced motion,
// the CSS animation runs alone.
export default function LogoCarouselTrack({ scrollReactive, children }: LogoCarouselTrackProps) {
  // Hooks
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia(REDUCED).matches) return
    if (typeof el.getAnimations !== 'function' || !('IntersectionObserver' in window)) return
    let visible = false
    let rate = 1
    let direction = 1
    let lastY = window.scrollY
    let applied: number | null = null
    let frame = 0

    const apply = (value: number) => {
      if (applied !== null && Math.abs(applied - value) < MARQUEE.writeThreshold) return
      applied = value
      setPlaybackRate(el, value)
    }
    const tick = () => {
      frame = 0
      const y = window.scrollY
      const signed = y - lastY
      const delta = Math.abs(signed)
      lastY = y
      if (delta >= MARQUEE.directionDeadzone) direction = signed > 0 ? 1 : -1
      const boost = Math.sqrt(Math.min(delta / MARQUEE.fullVelocity, 1))
      rate += (direction * (1 + boost * (MARQUEE.maxRate - 1)) - rate) * MARQUEE.easing
      const resting = delta === 0
      if (resting) {
        rate += (1 - rate) * MARQUEE.easing
        direction = 1
      }
      const settled = resting && Math.abs(rate - 1) < MARQUEE.settled
      if (settled) rate = 1
      if (visible) apply(rate)
      if (!settled && visible) frame = requestAnimationFrame(tick)
    }
    const handleScroll = () => {
      if (!frame && visible) frame = requestAnimationFrame(tick)
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting)
        el.style.animationPlayState = visible ? '' : 'paused'
        lastY = window.scrollY
        if (!visible) {
          applied = null
          setPlaybackRate(el, 1)
        }
      },
      { rootMargin: MARQUEE.margin },
    )
    observer.observe(el)
    if (scrollReactive) window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', handleScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scrollReactive])

  return (
    <div className="logo-carousel__track" ref={ref}>
      {children}
    </div>
  )
}
