'use client'

import { animate, stagger } from 'motion'
import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { HERO, remToPx } from '../data/motion'
import { type FocalPoint, focalStyle } from '../focal-point'
import { linkTarget } from '../link'
import Icon from './icon'

export type HeroSlide = {
  heading: string
  subheading?: string | undefined
  image: { url: string; alt: string; focal?: FocalPoint | undefined }
  cta?: { label: string; href: string; newTab?: boolean } | undefined
  cta2?: { label: string; href: string; newTab?: boolean } | undefined
  textPosition?: 'left' | 'center' | 'right' | undefined
}

// Port of sections/hero-carousel.liquid + hero-carousel.js: a CSS scroll-snap
// track, dots that reflect the snapped slide, prev/next, optional autoplay.
// Motion plays the slide entrance (copy rising in sequence) each time a slide
// becomes active, and a slow Ken Burns on its image. The first slide's copy is
// never hidden: it is the LCP element and paints with the server HTML.
export default function HeroCarousel({
  slides,
  autoplaySeconds = 5,
  heightVh = 72,
}: {
  slides: HeroSlide[]
  autoplaySeconds?: number
  heightVh?: number
}) {
  // Hooks
  const reduce = useReducedMotion()
  const [active, setActive] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const entered = useRef(false)
  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => setActive(Math.round(el.scrollLeft / el.clientWidth))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    const slide = track.current?.children[active]
    if (!slide || reduce) return
    const image = slide.querySelector('.hero-carousel__image')
    const zoom = image
      ? animate(
          image,
          { scale: [1, HERO.zoomScale] },
          { duration: HERO.zoomSeconds, ease: 'easeOut' },
        )
      : null
    // The copy already on screen at first paint stays put; later slides make an entrance.
    if (entered.current) {
      animate(
        slide.querySelectorAll('.hero-carousel__content > *'),
        { opacity: [0, 1], y: [remToPx(HERO.riseRem), 0] },
        { ...HERO.enter, delay: stagger(HERO.step) },
      )
    }
    entered.current = true
    return () => zoom?.stop()
  }, [active, reduce])
  useEffect(() => {
    if (!autoplaySeconds || slides.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => handleGo((active + 1) % slides.length), autoplaySeconds * 1000)
    return () => clearInterval(id)
  })

  // Event handlers
  const handleGo = (i: number) => {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="section-frame hero-carousel-frame">
      <div
        className="hero-carousel hero-carousel--full"
        data-scrim-tint="true"
        style={
          {
            '--hero-height': `${heightVh}vh`,
            '--hero-height-mobile': '70vh',
            '--hero-interval': `${autoplaySeconds}s`,
            '--hero-heading-scale': 1,
            '--hero-scrim-alpha': 0.55,
          } as React.CSSProperties
        }
      >
        <div className="hero-carousel__track" ref={track}>
          {slides.map((s, i) => {
            const pos = s.textPosition ?? 'left'
            return (
              <div
                key={s.heading}
                className={`hero-carousel__slide hero-carousel__slide--full_bleed${i === active ? ' is-active' : ''}`}
              >
                <div className="hero-carousel__media">
                  {s.image?.url ? (
                    <img
                      className="hero-carousel__image"
                      src={s.image.url}
                      alt={s.image.alt}
                      style={focalStyle(s.image.focal)}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      fetchPriority={i === 0 ? 'high' : undefined}
                      sizes="100vw"
                    />
                  ) : null}
                  <div className={`hero-carousel__scrim hero-carousel__scrim--${pos}`} />
                </div>
                <div className={`hero-carousel__content hero-carousel__content--${pos}`}>
                  {i === 0 ? (
                    <h1 className="hero-carousel__heading h1">{s.heading}</h1>
                  ) : (
                    <h2 className="hero-carousel__heading h1">{s.heading}</h2>
                  )}
                  {s.subheading ? (
                    <p className="hero-carousel__subheading text-body">{s.subheading}</p>
                  ) : null}
                  {s.cta || s.cta2 ? (
                    <div className="hero-carousel__ctas">
                      {s.cta ? (
                        <a href={s.cta.href} {...linkTarget(s.cta)} className="btn btn--primary">
                          {s.cta.label}
                        </a>
                      ) : null}
                      {s.cta2 ? (
                        <a
                          href={s.cta2.href}
                          {...linkTarget(s.cta2)}
                          className="btn btn--secondary hero-carousel__cta-secondary"
                        >
                          {s.cta2.label}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
        {slides.length > 1 ? (
          <>
            <button
              type="button"
              className="hero-carousel__control hero-carousel__control--prev"
              aria-label="Previous slide"
              onClick={() => handleGo((active - 1 + slides.length) % slides.length)}
            >
              <Icon name="arrow" size={16} />
            </button>
            <button
              type="button"
              className="hero-carousel__control hero-carousel__control--next"
              aria-label="Next slide"
              onClick={() => handleGo((active + 1) % slides.length)}
            >
              <Icon name="arrow" size={16} />
            </button>
            <div className="hero-carousel__dots">
              {slides.map((s, i) => (
                <button
                  key={s.heading}
                  type="button"
                  className={`hero-carousel__dot${i === active ? ' is-active' : ''}`}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === active}
                  onClick={() => handleGo(i)}
                >
                  <span className="hero-carousel__dot-fill" />
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
