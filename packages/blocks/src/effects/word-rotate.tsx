'use client'

// Adapted from Magic UI Word Rotate (MIT), https://magicui.design/docs/components/word-rotate.
// See THIRD_PARTY_NOTICES.md and packages/blocks/THIRD_PARTY_LICENSES.md.
// Changes: an inline span that keeps the line's height (no layout jump between words), each
// word slides in with Motion's vanilla `animate` loaded after hydration, the first word is the
// server and reduced-motion rendering, and screen readers hear every word once.
import { useEffect, useRef, useState } from 'react'
import { loadMotion } from '../lazy-motion'
import { useReducedMotion } from '../use-reduced-motion'

type WordRotateProps = {
  words: string[]
  /** Seconds each word stays. */
  holdSeconds?: number | undefined
  className?: string | undefined
}

/** Words that take turns in one spot of a heading, sliding down into place. */
export default function WordRotate({ words, holdSeconds = 2.5, className }: WordRotateProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const word = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (reducedMotion || words.length < 2) return
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      Math.max(1, holdSeconds) * 1000,
    )
    return () => window.clearInterval(timer)
  }, [reducedMotion, words.length, holdSeconds])
  useEffect(() => {
    const el = word.current
    if (!el || index === 0 || reducedMotion) return
    loadMotion()
      .then(({ animate }) =>
        animate(el, { opacity: [0, 1], y: ['-0.4em', '0em'] }, { duration: 0.25, ease: 'easeOut' }),
      )
      .catch(() => {})
  }, [index, reducedMotion])

  // Early returns
  if (words.length === 0) return null

  // Render logic
  const current = words[reducedMotion ? 0 : index % words.length] ?? words[0]

  return (
    <span className={className}>
      <span className="sr-only">{words.join(', ')}</span>
      <span ref={word} key={current} aria-hidden className="inline-block">
        {current}
      </span>
    </span>
  )
}
