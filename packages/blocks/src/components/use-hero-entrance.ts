import { type RefObject, useEffect, useRef } from 'react'
import { HERO_CAROUSEL } from '../data/glide/hero-carousel'
import { HERO, remToPx } from '../data/motion'
import { loadMotion } from '../lazy-motion'

/** The rest opacity a child returns to after its entrance (the subheading stays muted). */
function restOpacity(el: Element): number {
  const value = Number.parseFloat(getComputedStyle(el).getPropertyValue('--hero-rest-opacity'))
  return Number.isFinite(value) ? value : 1
}

/**
 * The staggered entrance of section-hero-carousel.css, played with Motion each time a slide
 * becomes active: copy rises in sequence, the headline word by word when it was split. The
 * copy already on screen at first paint never animates (it is the LCP element), and Motion is
 * fetched only once a later slide needs it.
 */
export function useHeroEntrance(
  track: RefObject<HTMLElement | null>,
  active: number,
  enabled: boolean,
): void {
  const entered = useRef(false)
  useEffect(() => {
    const slide = track.current?.children[active]
    const enter = entered.current
    entered.current = true
    if (!slide || !enabled || !enter) return
    let live = true
    loadMotion()
      .then(({ animate, stagger }) => {
        if (!live) return
        const rise = remToPx(HERO.riseRem)
        Array.from(slide.querySelectorAll('.hero-carousel__content > *')).forEach((child, i) => {
          const words = child.querySelectorAll('.hero-carousel__word')
          const delay = HERO.step * i
          if (words.length > 0) {
            animate(
              words,
              { opacity: [0, 1], y: [`${HERO_CAROUSEL.wordRiseEm}em`, '0em'] },
              { ...HERO.enter, delay: stagger(HERO_CAROUSEL.wordStep, { startDelay: delay }) },
            )
            return
          }
          animate(
            child,
            { opacity: [0, restOpacity(child)], y: [rise, 0] },
            { ...HERO.enter, delay },
          )
        })
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [track, active, enabled])
}
