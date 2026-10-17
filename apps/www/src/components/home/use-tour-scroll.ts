'use client'

import { type RefObject, useEffect, useEffectEvent, useRef, useState } from 'react'
import { loadGsap } from '@/lib/gsap'

type UseTourScrollOptions = {
  sectionRef: RefObject<HTMLElement | null>
  /** The active rail item's progress line; its scale follows the scroll within the item. */
  progressRef: RefObject<HTMLElement | null>
  count: number
  onIndex: (index: number) => void
}

/** Scroll distance given to each feature, as a share of the viewport height. */
const VH_PER_ITEM = 75
const PIN_QUERY =
  '(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)'

/**
 * Pins the tour section and maps scroll progress to the active feature (GSAP ScrollTrigger, loaded
 * lazily). Returns whether the pin is on and a function that scrolls to a feature's position.
 * Below the desktop breakpoint, or with reduced motion, nothing is pinned and the tour falls back
 * to its own timer.
 */
export default function useTourScroll({
  sectionRef,
  progressRef,
  count,
  onIndex,
}: UseTourScrollOptions) {
  // Hooks
  const [pinned, setPinned] = useState(false)
  const triggerRef = useRef<{ start: number; end: number } | null>(null)
  const emitIndex = useEffectEvent(onIndex)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    let cancelled = false
    let revert = () => {}
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (cancelled) return
      const query = gsap.matchMedia()
      query.add(PIN_QUERY, () => {
        let lastIndex = -1
        const trigger = ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: `+=${count * VH_PER_ITEM}%`,
          pin: true,
          anticipatePin: 1,
          onRefresh: (self) => {
            triggerRef.current = { start: self.start, end: self.end }
          },
          onUpdate: (self) => {
            const position = Math.min(count - 0.0001, self.progress * count)
            const index = Math.floor(position)
            if (index !== lastIndex) {
              lastIndex = index
              emitIndex(index)
            }
            const line = progressRef.current
            if (line) line.style.transform = `scaleY(${(position - index).toFixed(3)})`
          },
        })
        setPinned(true)
        return () => {
          trigger.kill()
          triggerRef.current = null
          setPinned(false)
        }
      })
      revert = () => query.revert()
    })
    return () => {
      cancelled = true
      revert()
    }
  }, [sectionRef, progressRef, count])

  const scrollToIndex = (index: number) => {
    const range = triggerRef.current
    if (!range) return
    const top = range.start + ((range.end - range.start) * (index + 0.04)) / count
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return { pinned, scrollToIndex }
}
