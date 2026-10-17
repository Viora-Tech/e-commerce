'use client'

import { type ElementType, type ReactNode, useEffect, useRef } from 'react'
import { loadGsap, prefersReducedMotion } from '@/lib/gsap'

type SplitTextProps = {
  children: string
  as?: ElementType
  className?: string
  /** Seconds between words. */
  stagger?: number
  /** Reveal in step with the scroll (a text-mask wipe) instead of once on enter. */
  scrub?: boolean
  /** Extra markup rendered after the text (never split). */
  after?: ReactNode
}

/**
 * Headline whose words rise into place when it scrolls into view (GSAP SplitText, loaded lazily).
 * The text renders in full on the server and stays readable without JS or with reduced motion;
 * headlines that are already on screen at load are left alone so nothing waits on a script.
 */
export default function SplitReveal({
  children,
  as: Tag = 'h2',
  className,
  stagger = 0.05,
  scrub = false,
  after,
}: SplitTextProps) {
  // Hooks
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || prefersReducedMotion()) return
    if (element.getBoundingClientRect().top < window.innerHeight * 0.9) return
    let cancelled = false
    let cleanup = () => {}
    loadGsap().then(({ gsap, ScrollTrigger, SplitText }) => {
      if (cancelled) return
      const split = SplitText.create(element, { type: 'words', mask: 'words', aria: 'auto' })
      gsap.set(split.words, { yPercent: 110 })
      if (scrub) {
        const tween = gsap.to(split.words, {
          yPercent: 0,
          ease: 'none',
          stagger: 0.15,
          scrollTrigger: { trigger: element, start: 'top 96%', end: 'top 58%', scrub: 0.5 },
        })
        cleanup = () => {
          tween.scrollTrigger?.kill()
          tween.kill()
          split.revert()
        }
        return
      }
      const trigger = ScrollTrigger.create({
        trigger: element,
        start: 'top 88%',
        once: true,
        onEnter: () =>
          gsap.to(split.words, { yPercent: 0, duration: 0.8, ease: 'expo.out', stagger }),
      })
      cleanup = () => {
        trigger.kill()
        split.revert()
      }
    })
    return () => {
      cancelled = true
      cleanup()
    }
  }, [stagger, scrub])

  return (
    <Tag ref={ref} className={className}>
      {children}
      {after}
    </Tag>
  )
}
