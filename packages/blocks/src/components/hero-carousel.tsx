'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { heroCarouselContent as copy, HERO_CAROUSEL } from '../data/zero-drift/hero-carousel'
import { useReducedMotion } from '../use-reduced-motion'
import HeroSlideView, { type HeroSlide } from './hero-slide-view'
import Icon from './icon'
import { useHeroAutoplay } from './use-hero-autoplay'
import { useHeroEnhancements } from './use-hero-enhancements'
import { useHeroEntrance } from './use-hero-entrance'

export type { HeroSlide } from './hero-slide-view'

type HeroCarouselProps = {
  slides: HeroSlide[]
  /** Seconds per slide; 0 turns autoplay off (how slides saved before the Glide refresh say it). */
  autoplaySeconds?: number | undefined
  /** Slide height as a share of the screen. */
  heightVh?: number | undefined
  heightMobileVh?: number | undefined
  heightMode?: 'fixed' | 'viewport' | undefined
  frame?: 'full' | 'inset' | undefined
  pin?: boolean | undefined
  showArrows?: boolean | undefined
  showDots?: boolean | undefined
  dotProgress?: boolean | undefined
  headingScale?: number | undefined
  showCounter?: boolean | undefined
  scrimOpacity?: number | undefined
  scrimTint?: boolean | undefined
  grain?: boolean | undefined
  zoom?: boolean | undefined
  entrance?: boolean | undefined
  wordEntrance?: boolean | undefined
  parallax?: boolean | undefined
  scrollCue?: boolean | undefined
  /** A string in storage but a React node while editing on the canvas. */
  scrollCueText?: ReactNode
  lowStockThreshold?: number | undefined
}

const SECOND = 1000
const PERCENT = 100

/** Left scroll offset that snaps `slide` into place, honouring the inset frame's peek padding. */
function slideLeft(track: HTMLElement, slide: HTMLElement): number {
  const pad = Number.parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0
  return slide.offsetLeft - track.offsetLeft - pad
}

// Port of sections/hero-carousel.liquid + assets/hero-carousel.js: a CSS scroll-snap track of
// picture and video slides with arrows, progress dots, autoplay that pauses like a video, a loop
// copy of slide one so the wrap keeps moving forward, and Motion for each slide's entrance. The
// first slide's copy is never hidden: it is the LCP element and paints with the server HTML, and
// Motion itself is fetched after hydration (`loadMotion`), never with the page.
export default function HeroCarousel({
  slides,
  autoplaySeconds = 5,
  heightVh = 72,
  heightMobileVh = 70,
  heightMode = 'fixed',
  frame = 'full',
  pin = false,
  showArrows = true,
  showDots = true,
  dotProgress = true,
  headingScale = 100,
  showCounter = false,
  scrimOpacity = 55,
  scrimTint = true,
  grain = false,
  zoom = true,
  entrance = true,
  wordEntrance = false,
  parallax = false,
  scrollCue = false,
  scrollCueText,
  lowStockThreshold = 5,
}: HeroCarouselProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [cloneActive, setCloneActive] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const cancelReset = useRef<() => void>(() => {})
  const autoplay = useHeroAutoplay(
    root,
    autoplaySeconds > 0 && slides.length > 1 && !reduce,
    autoplaySeconds * SECOND,
    () => handleGo(active + 1),
  )
  useHeroEnhancements(root, track, { viewport: heightMode === 'viewport', parallax, pin })
  // biome-ignore lint/correctness/useExhaustiveDependencies: scheduleLoopReset only touches refs and state setters.
  useEffect(() => {
    const el = track.current
    const total = slides.length
    if (!el || total < 2) return
    const children = Array.from(el.children)
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio <= 0.5) continue
          const index = children.indexOf(entry.target)
          if (index === total) {
            setActive(0)
            scheduleLoopReset()
          } else if (index >= 0) setActive(index)
        }
      },
      { root: el, threshold: [0.5] },
    )
    for (const child of children) seen.observe(child)
    return () => seen.disconnect()
  }, [slides.length])
  useEffect(() => () => cancelReset.current(), [])
  useHeroEntrance(track, active, entrance && !reduce)

  // Helpers
  /** Once the wrap has scrolled onto the loop copy, jump back to the real slide one unseen. */
  const scheduleLoopReset = () => {
    const el = track.current
    cancelReset.current()
    if (!el) return
    const done = () => {
      cancelReset.current()
      const first = el.children[0] as HTMLElement | undefined
      if (!first) return
      const previous = el.style.scrollBehavior
      el.style.scrollBehavior = 'auto'
      el.scrollTo({ left: slideLeft(el, first), behavior: 'instant' })
      el.style.scrollBehavior = previous
      setCloneActive(false)
    }
    const timer = window.setTimeout(done, HERO_CAROUSEL.loopResetMs)
    el.addEventListener('scrollend', done, { once: true })
    cancelReset.current = () => {
      window.clearTimeout(timer)
      el.removeEventListener('scrollend', done)
      cancelReset.current = () => {}
    }
  }

  // Event handlers
  const handleGo = (index: number) => {
    const el = track.current
    const total = slides.length
    if (!el || total === 0) return
    const target = ((index % total) + total) % total
    const wrap = total > 1 && index >= total
    const destination = el.children[wrap ? total : target] as HTMLElement | undefined
    if (!destination) return
    el.scrollTo({ left: slideLeft(el, destination), behavior: reduce ? 'instant' : 'smooth' })
    if (wrap) {
      setCloneActive(true)
      scheduleLoopReset()
    }
    autoplay.restart()
    setActive(target)
  }
  const handleScrollCue = () => {
    let next = root.current?.closest('.hero-carousel-frame')?.nextElementSibling
    while (next && next.getBoundingClientRect().height === 0) next = next.nextElementSibling
    next?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  // Render logic
  const total = slides.length
  const progress = dotProgress && autoplaySeconds > 0 && total > 1
  const style = {
    '--hero-height': `${heightVh}vh`,
    '--hero-height-mobile': `${heightMobileVh}vh`,
    '--hero-interval': `${autoplaySeconds}s`,
    '--hero-heading-scale': headingScale / PERCENT,
    '--hero-scrim-alpha': scrimOpacity / PERCENT,
  } as React.CSSProperties
  const slideProps = { total, showCounter, wordEntrance, lowStockThreshold }

  return (
    <div className="section-frame hero-carousel-frame">
      <div
        ref={root}
        className={`hero-carousel hero-carousel--${frame}${pin ? ' hero-carousel--pinned' : ''}${autoplay.paused ? ' is-paused' : ''}`}
        data-zoom={zoom}
        data-height-mode={heightMode}
        data-scrim-tint={scrimTint}
        data-parallax={parallax}
        data-grain={grain}
        style={style}
      >
        <div className="hero-carousel__track" ref={track}>
          {slides.map((slide, i) => (
            <HeroSlideView
              // biome-ignore lint/suspicious/noArrayIndexKey: slides are an ordered list with no ids; their copy may be a React node.
              key={i}
              slide={slide}
              index={i}
              active={i === active}
              {...slideProps}
            />
          ))}
          {total > 1 && slides[0] ? (
            <HeroSlideView slide={slides[0]} index={0} active={cloneActive} clone {...slideProps} />
          ) : null}
        </div>
        {showArrows && total > 1 ? (
          <>
            <button
              type="button"
              className="hero-carousel__control hero-carousel__control--prev"
              aria-label={copy.previous}
              onClick={() => handleGo(active - 1)}
            >
              <Icon name="arrow" size={16} />
            </button>
            <button
              type="button"
              className="hero-carousel__control hero-carousel__control--next"
              aria-label={copy.next}
              onClick={() => handleGo(active + 1)}
            >
              <Icon name="arrow" size={16} />
            </button>
          </>
        ) : null}
        {showDots && total > 1 ? (
          <div className={`hero-carousel__dots${progress ? ' hero-carousel__dots--progress' : ''}`}>
            {slides.map((_, i) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: one dot per slide position.
                key={i}
                type="button"
                className={`hero-carousel__dot${i === active ? ' is-active' : ''}`}
                aria-label={copy.goTo(i + 1)}
                aria-current={i === active}
                onClick={() => handleGo(i)}
              >
                {progress ? (
                  <span
                    key={i === active ? autoplay.run : 'idle'}
                    className={`hero-carousel__dot-fill${autoplay.running && i === active ? ' is-running' : ''}`}
                  />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
        {scrollCue ? (
          <button type="button" className="hero-carousel__scroll-cue" onClick={handleScrollCue}>
            <span className="hero-carousel__scroll-cue-label text-caption">
              {scrollCueText || copy.scrollCue}
            </span>
            <Icon name="arrow-down" size={16} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
