'use client'

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { reviewsWidgetsContent as copy } from '../../../data/reviews-widgets'
import type { StoreReviews } from '../../../types'
import { useReducedMotion } from '../../../use-reduced-motion'
import Icon from '../../icon'
import RatingStars from '../../rating-stars'
import SectionHeading from '../../section-heading'
import WidgetReviewCard, { type WidgetCardStyle } from './widget-review-card'

type ReviewsCarouselProps = {
  kicker: ReactNode
  heading: ReactNode
  data: StoreReviews
  showSummary: boolean
  showProduct: boolean
  showPhotos: boolean
  showDate: boolean
  cardStyle: WidgetCardStyle
  autoplay: boolean
  /** Seconds each review stays before the next slides in. */
  speed: number
}

const ARROW =
  'inline-flex size-10 touch-manipulation items-center justify-center rounded-full border border-line bg-bg text-ink transition-[scale,border-color] duration-(--duration-press) ease-out hover:border-ink active:scale-(--motion-press-scale) disabled:opacity-40'

/** One card's step: its width plus the gap after it. */
function step(track: HTMLElement): number {
  const first = track.firstElementChild as HTMLElement | null
  const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0
  return (first?.offsetWidth ?? track.clientWidth) + gap
}

const atEnd = (track: HTMLElement) => track.scrollLeft + track.clientWidth >= track.scrollWidth - 4

/**
 * Reviews in a row of cards that scrolls sideways (swipe, arrows or by itself). Autoplay pauses
 * while a shopper hovers or focuses it, can be paused with its button, and never runs for a
 * shopper who asked their device for less motion.
 */
export default function ReviewsCarousel({
  kicker,
  heading,
  data,
  showSummary,
  showProduct,
  showPhotos,
  showDate,
  cardStyle,
  autoplay,
  speed,
}: ReviewsCarouselProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const track = useRef<HTMLUListElement>(null)
  useEffect(() => {
    if (!autoplay || reduce || paused || held || data.reviews.length < 2) return
    const timer = window.setInterval(() => {
      const el = track.current
      if (!el) return
      if (atEnd(el)) el.scrollTo({ left: 0, behavior: 'smooth' })
      else el.scrollBy({ left: step(el), behavior: 'smooth' })
    }, Math.max(2, speed) * 1000)
    return () => window.clearInterval(timer)
  }, [autoplay, reduce, paused, held, data.reviews.length, speed])

  // Event handlers
  const handleMove = (direction: 1 | -1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: direction * step(el), behavior: reduce ? 'auto' : 'smooth' })
  }

  // Render logic
  const { summary, reviews } = data

  return (
    <section
      aria-roledescription="carousel"
      aria-label={copy.carouselLabel}
      className="page-width flex flex-col gap-6"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        {heading || kicker ? <SectionHeading kicker={kicker} heading={heading} /> : <span />}
        <div className="flex items-center gap-3">
          {showSummary ? (
            <span className="flex items-center gap-2 text-sm text-muted">
              <RatingStars rating={summary.rating} hideValue />
              <span className="font-semibold text-ink tabular-nums">
                {summary.rating.toFixed(1)}
              </span>
              <span>{copy.reviewsCount(summary.count)}</span>
            </span>
          ) : null}
          {reviews.length > 1 ? (
            <span className="flex gap-2">
              {autoplay && !reduce ? (
                <button
                  type="button"
                  className={ARROW}
                  aria-label={paused ? copy.play : copy.pause}
                  onClick={() => setPaused((p) => !p)}
                >
                  <Icon name={paused ? 'play' : 'pause'} size={16} />
                </button>
              ) : null}
              <button
                type="button"
                className={ARROW}
                aria-label={copy.previous}
                onClick={() => handleMove(-1)}
              >
                <span className="inline-flex rotate-180">
                  <Icon name="arrow-right" size={16} />
                </span>
              </button>
              <button
                type="button"
                className={ARROW}
                aria-label={copy.next}
                onClick={() => handleMove(1)}
              >
                <Icon name="arrow-right" size={16} />
              </button>
            </span>
          ) : null}
        </div>
      </div>
      <ul
        ref={track}
        className="m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((r, i) => (
          <li
            key={r.id}
            aria-label={copy.slide(i + 1, reviews.length)}
            className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]"
          >
            <WidgetReviewCard
              review={r}
              cardStyle={cardStyle}
              showProduct={showProduct}
              showPhotos={showPhotos}
              showDate={showDate}
              clip={260}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
