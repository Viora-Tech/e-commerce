'use client'

// Port of assets/reviews-showcase.js (browser slideshow): customer photos in Magic UI's Safari window
// (`effects/safari.tsx`, as the theme's comment names it),
// one at a time, cross-fading every 4.5s with a progress bar and an "n / total" counter.
// Pauses while hovered and while off-screen; with reduced motion the first photo stays up
// and a click on the frame moves on.
import { useEffect, useRef, useState } from 'react'
import { reviewsShowcaseContent as copy } from '../../../data/glide/reviews-showcase'
import Safari from '../../../effects/safari'
import { focalStyle } from '../../../focal-point'
import type { Image } from '../../../sections/framed'
import { safeHref } from '../../../slot-types'
import { useReducedMotion } from '../../../use-reduced-motion'
import Picture from '../../picture'

export type BrowserSlide = {
  photo: Image
  name: string
  rating: number
  productName: string
  productHref: string
}

type ReviewsBrowserProps = {
  slides: BrowserSlide[]
  label: string
}

const SLIDE_MS = 4500

export default function ReviewsBrowser({ slides, label }: ReviewsBrowserProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(true)
  const frame = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = frame.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => setVisible(!!entries[0]?.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: `active` restarts the timer after every slide change, including a click.
  useEffect(() => {
    const count = slides.length
    if (paused || !visible || reduce || count < 2) return
    const id = setTimeout(() => setActive((i) => (i + 1) % count), SLIDE_MS)
    return () => clearTimeout(id)
  }, [active, paused, visible, reduce, slides.length])

  // Event handlers
  const handleEnter = () => setPaused(true)
  const handleLeave = () => {
    setPaused(false)
    setActive((i) => (i + 1) % slides.length)
  }
  const handleScreenClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('a')) return
    setActive((i) => (i + 1) % slides.length)
  }

  // Render logic
  const count = slides.length
  const running = !reduce && count > 1

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover pause is a decorative enhancement; the slideshow also advances on its own and every photo is in the page.
    <div
      ref={frame}
      className="rs-browser"
      style={{ '--rs-slide': `${SLIDE_MS / 1000}s` } as React.CSSProperties}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Safari url={label}>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: click-to-advance is a pointer convenience over an auto-advancing slideshow. */}
        <div className="rs-browser__screen" onClick={handleScreenClick}>
          {slides.map((slide, i) => {
            const href = safeHref(slide.productHref)
            return (
              <figure
                // biome-ignore lint/suspicious/noArrayIndexKey: slides are derived from the reviews list and never reorder between renders.
                key={`${slide.name}-${i}`}
                className={`rs-browser__slide${i === active ? ' is-active' : ''}`}
              >
                <Picture
                  image={slide.photo}
                  alt={copy.photoAlt(slide.name, slide.productName)}
                  style={focalStyle(slide.photo.focal)}
                  fill
                  sizes="(min-width: 990px) 50vw, 100vw"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
                <figcaption className="rs-browser__caption">
                  <span className="rs-browser__caption-stars" aria-hidden="true">
                    {copy.starGlyph.repeat(Math.max(0, Math.round(slide.rating)))}
                  </span>
                  <span className="rs-browser__caption-name">{slide.name}</span>
                  {slide.productName ? (
                    href ? (
                      <a className="rs-browser__caption-product" href={href}>
                        {slide.productName}
                      </a>
                    ) : (
                      <span className="rs-browser__caption-product">{slide.productName}</span>
                    )
                  ) : null}
                </figcaption>
              </figure>
            )
          })}
        </div>
        <span className="rs-browser__count" aria-hidden="true">
          {copy.photoCounter(active + 1, count)}
        </span>
        <div className="rs-browser__progress" aria-hidden="true">
          <span
            key={active}
            className={`${running ? 'is-running' : ''}${paused ? ' is-paused' : ''}`.trim()}
          />
        </div>
      </Safari>
    </div>
  )
}
