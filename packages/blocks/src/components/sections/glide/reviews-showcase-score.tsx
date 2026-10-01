'use client'

// Port of assets/reviews-showcase.js (count-up): the big score counts from 0 to the average
// the first time it scrolls into view. Server HTML and reduced motion keep the final number.
import { useEffect, useRef, useState } from 'react'
import { reviewsShowcaseContent as copy } from '../../../data/glide/reviews-showcase'
import { loadMotion } from '../../../lazy-motion'
import { useReducedMotion } from '../../../use-reduced-motion'

type ReviewsScoreProps = {
  rating: number
  label: string
}

const COUNT_SECONDS = 1.4
const VISIBLE_SHARE = 0.6
/** Ease-out quart, the theme's curve. */
const EASE_OUT_QUART = [0.165, 0.84, 0.44, 1] as const

export default function ReviewsScore({ rating, label }: ReviewsScoreProps) {
  // Hooks
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(rating.toFixed(1))
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el || reduce || typeof IntersectionObserver === 'undefined') return
    let live = true
    let stop: (() => void) | undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        observer.disconnect()
        loadMotion()
          .then(({ animate }) => {
            if (!live) return
            const run = animate(0, rating, {
              duration: COUNT_SECONDS,
              ease: EASE_OUT_QUART,
              onUpdate: (v) => setShown(v.toFixed(1)),
              onComplete: () => setShown(rating.toFixed(1)),
            })
            stop = () => run.stop()
          })
          .catch(() => {})
      },
      { threshold: VISIBLE_SHARE },
    )
    observer.observe(el)
    return () => {
      live = false
      observer.disconnect()
      stop?.()
    }
  }, [rating, reduce])

  return (
    <div className="reviews-showcase__score" role="img" aria-label={label}>
      <span ref={box} className="reviews-showcase__number" aria-hidden="true">
        {shown}
      </span>
      <span className="reviews-showcase__out-of" aria-hidden="true">
        {copy.scoreOutOf}
      </span>
    </div>
  )
}
