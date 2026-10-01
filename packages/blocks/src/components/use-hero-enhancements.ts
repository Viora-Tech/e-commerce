import { type RefObject, useEffect } from 'react'
import { HERO_CAROUSEL } from '../data/glide/hero-carousel'

type HeroEnhancements = {
  /** "Fill the screen" height: publish what sits above the hero for the stylesheet to subtract. */
  viewport: boolean
  /** A few pixels of pointer drift on the media (fine pointers, motion allowed). */
  parallax: boolean
  /** Release the pinned hero once the next section has covered it. */
  pin: boolean
}

/**
 * The progressive enhancements of Glide's hero-carousel.js that are not the slide clock:
 * a vertical wheel always scrolls the page (never the track), the viewport-height offset,
 * pointer parallax and the pinned hero's release. `root` is the `.hero-carousel` element,
 * `track` its scroll-snap track; both only gain behaviour, so the server HTML stands alone.
 */
export function useHeroEnhancements(
  root: RefObject<HTMLElement | null>,
  track: RefObject<HTMLElement | null>,
  { viewport, parallax, pin }: HeroEnhancements,
): void {
  useEffect(() => {
    const el = track.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [track])

  useEffect(() => {
    const el = root.current
    if (!viewport || !el) return
    let frame = 0
    let last = -1
    const measure = () => {
      frame = 0
      const top = el.getBoundingClientRect().top + window.scrollY
      const offset = Math.ceil(
        Math.min(Math.max(top, 0), window.innerHeight * HERO_CAROUSEL.viewportFloor),
      )
      if (offset === last) return
      last = offset
      el.style.setProperty('--hero-viewport-offset', `${offset}px`)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('resize', schedule)
    const body = new ResizeObserver(schedule)
    body.observe(document.body)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      body.disconnect()
    }
  }, [root, viewport])

  useEffect(() => {
    const el = root.current
    if (!parallax || !el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return
    let frame = 0
    let pointer: PointerEvent | null = null
    const onMove = (event: PointerEvent) => {
      pointer = event
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = el.getBoundingClientRect()
        if (!pointer || !rect.width || !rect.height) return
        const x = ((pointer.clientX - rect.left) / rect.width - 0.5) * 2
        const y = ((pointer.clientY - rect.top) / rect.height - 0.5) * 2
        el.style.setProperty('--hero-px', x.toFixed(3))
        el.style.setProperty('--hero-py', y.toFixed(3))
      })
    }
    const onLeave = () => {
      el.style.setProperty('--hero-px', '0')
      el.style.setProperty('--hero-py', '0')
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [root, parallax])

  useEffect(() => {
    const host = root.current?.closest('.hero-carousel-frame')
    const next = host?.nextElementSibling
    if (!pin || !host || !next) return
    const onScroll = () =>
      host.classList.toggle(
        'hero-pin-released',
        next.getBoundingClientRect().top < -HERO_CAROUSEL.pinReleasePx,
      )
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [root, pin])
}
