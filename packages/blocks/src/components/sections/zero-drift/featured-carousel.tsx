'use client'

// Port of sections/featured-carousel.liquid (+ assets/featured-carousel.js): several featured products, one lockup at a time
import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useState } from 'react'
import {
  featuredCarouselContent as copy,
  FEATURED_CAROUSEL,
} from '../../../data/zero-drift/featured-carousel'
import type { CardProduct } from '../../../types'
import { useReducedMotion } from '../../../use-reduced-motion'
import Icon from '../../icon'
import FeaturedCarouselSlide from './featured-carousel-slide'

export type FeaturedCarouselProps = {
  /** The ReactNode props are strings in storage but React nodes while editing on the canvas. */
  eyebrow: ReactNode
  heading: ReactNode
  imageSide: 'left' | 'right'
  autoplay: boolean
  intervalSeconds: number
  showStamp: boolean
  stampText: string
  showShare: boolean
  showHelp: boolean
  helpHref: string
  slides: { product: CardProduct; eyebrow: ReactNode }[]
}

const SECOND = 1000

export default function FeaturedCarousel({
  eyebrow,
  heading,
  imageSide,
  autoplay,
  intervalSeconds,
  showStamp,
  stampText,
  showShare,
  showHelp,
  helpHref,
  slides,
}: FeaturedCarouselProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [origin, setOrigin] = useState('')
  // Any real interaction means someone is buying: autoplay stops for good (never resumes).
  const [stopped, setStopped] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    setReady(true)
    setOrigin(window.location.origin)
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  useEffect(() => {
    const total = slides.length
    if (!ready || !autoplay || reduce || stopped || hovering || hidden || total < 2) return
    const seconds =
      Number.isFinite(intervalSeconds) && intervalSeconds >= 1
        ? intervalSeconds
        : FEATURED_CAROUSEL.defaultIntervalSeconds
    const id = window.setInterval(() => setIndex((i) => (i + 1) % total), seconds * SECOND)
    return () => window.clearInterval(id)
  }, [ready, autoplay, reduce, stopped, hovering, hidden, slides.length, intervalSeconds])

  // Event handlers
  const handleGo = (step: number) => setIndex((i) => (i + step + slides.length) % slides.length)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    setStopped(true)
    handleGo(event.key === 'ArrowLeft' ? -1 : 1)
  }
  const handleStop = () => setStopped(true)

  // Early returns
  const total = slides.length
  if (total === 0) {
    return (
      <div className="section-featured-carousel page-width">
        <p className="featured-carousel__empty text-body">{copy.empty}</p>
      </div>
    )
  }

  // Render logic
  const current = Math.min(index, total - 1)
  const vars = { '--fc-index': current } as CSSProperties

  return (
    <div className="section-featured-carousel page-width">
      {heading || eyebrow ? (
        <div className="featured-carousel__head">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          {heading ? <h2 className="featured-carousel__heading h2">{heading}</h2> : null}
        </div>
      ) : null}

      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys page the slides; the dots and arrows are the buttons. */}
      <div
        className={`featured-carousel${ready ? ' featured-carousel--ready' : ''}`}
        onKeyDown={handleKeyDown}
        onPointerDown={handleStop}
        onFocus={handleStop}
        onChange={handleStop}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="featured-carousel__viewport">
          <div className="featured-carousel__track" style={vars}>
            {slides.map((slide, i) => {
              const isCurrent = i === current
              // Only the current slide is reachable once the carousel runs: the others are
              // inert so a buy box nobody can see takes no tab stops.
              const hide = ready && !isCurrent
              return (
                // biome-ignore lint/a11y/useSemanticElements: a slide group with aria-roledescription, not a form fieldset.
                <div
                  key={slide.product.handle}
                  className={`featured-carousel__slide${isCurrent ? ' is-current' : ''}`}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} ${copy.slideOf} ${total}`}
                  aria-hidden={hide ? true : undefined}
                  inert={hide}
                >
                  <FeaturedCarouselSlide
                    product={slide.product}
                    eyebrow={slide.eyebrow}
                    flip={imageSide === 'right'}
                    showStamp={showStamp}
                    stampText={stampText}
                    showShare={showShare}
                    showHelp={showHelp}
                    helpHref={helpHref}
                    origin={origin}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {total > 1 ? (
          <div className="featured-carousel__controls">
            <button
              type="button"
              className="featured-carousel__arrow"
              aria-label={copy.previous}
              onClick={() => handleGo(-1)}
            >
              <Icon name="arrow" size={16} />
            </button>
            <div className="featured-carousel__dots" role="tablist">
              {slides.map((slide, i) => (
                <button
                  key={slide.product.handle}
                  type="button"
                  role="tab"
                  className={`featured-carousel__dot${i === current ? ' is-current' : ''}`}
                  aria-label={`${copy.goTo} ${i + 1}`}
                  aria-selected={i === current}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
            <button
              type="button"
              className="featured-carousel__arrow featured-carousel__arrow--next"
              aria-label={copy.next}
              onClick={() => handleGo(1)}
            >
              <Icon name="arrow" size={16} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
