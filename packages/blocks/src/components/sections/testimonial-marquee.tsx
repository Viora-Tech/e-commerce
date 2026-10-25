'use client'

// Adapted from Magic UI's Marquee (MIT). See THIRD_PARTY_NOTICES.md and
// packages/blocks/THIRD_PARTY_LICENSES.md.
import { type ReactNode, useEffect, useRef } from 'react'
import { loadMotion } from '../../lazy-motion'
import { useReducedMotion } from '../../use-reduced-motion'

/** Copy is a string in storage, a React node while edited on the canvas. */
type Testimonial = { quote: ReactNode; author: ReactNode; role: ReactNode }

type TestimonialMarqueeProps = { heading: ReactNode; items: Testimonial[] }

const DURATION = 40
const LOOP = { duration: DURATION, repeat: Infinity, ease: 'linear' } as const

const keyframes = (reverse: boolean) => (reverse ? ['-50%', '0%'] : ['0%', '-50%'])

// Two rows scrolling opposite directions, pause on hover, each duplicated track animated with
// Motion (no CSS keyframes, fetched after hydration). Reduced motion renders both rows static and
// fully visible.
export default function TestimonialMarquee({ heading, items }: TestimonialMarqueeProps) {
  // Early returns
  if (items.length === 0) return null

  // Render logic
  const half = Math.ceil(items.length / 2)
  const rowOne = items.slice(0, half)
  const rowTwo = items.slice(half).length > 0 ? items.slice(half) : rowOne

  return (
    <div className="page-width">
      {heading ? <h2 className="h2 text-center text-[var(--color-ink)]">{heading}</h2> : null}
      <div className="mt-[1.5rem] flex flex-col gap-[1rem]">
        <Row items={rowOne} reverse={false} />
        <Row items={rowTwo} reverse />
      </div>
    </div>
  )
}

function Row({ items, reverse }: { items: Testimonial[]; reverse: boolean }) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  const loop = useRef<{ stop(): void } | null>(null)
  useEffect(() => {
    if (reducedMotion) return
    let live = true
    loadMotion()
      .then(({ animate }) => {
        const el = track.current
        if (!live || !el) return
        loop.current = animate(el, { x: keyframes(reverse) }, LOOP)
      })
      .catch(() => {})
    return () => {
      live = false
      loop.current?.stop()
      loop.current = null
    }
  }, [reverse, reducedMotion])

  // Event handlers
  const handlePause = () => {
    loop.current?.stop()
  }
  const handleResume = () => {
    const el = track.current
    if (reducedMotion || !el) return
    loadMotion()
      .then(({ animate }) => {
        loop.current?.stop()
        loop.current = animate(el, { x: keyframes(reverse) }, LOOP)
      })
      .catch(() => {})
  }

  // Render logic
  const cards = items.map((t, i) => (
    <blockquote
      // biome-ignore lint/suspicious/noArrayIndexKey: merchant-edited rows carry no id and never reorder between renders.
      key={i}
      className="mx-[0.5rem] w-[20rem] shrink-0 rounded-[var(--radius-card)] border border-[var(--color-line)] bg-[var(--color-surface)] p-[1.25rem]"
    >
      <p className="text-body text-[var(--color-ink)]">{t.quote}</p>
      <footer className="text-small mt-[0.75rem] text-[var(--color-muted)]">
        <strong className="text-[var(--color-ink)]">{t.author}</strong>
        {t.role ? <span> · {t.role}</span> : null}
      </footer>
    </blockquote>
  ))

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover pause/resume is a decorative enhancement over an always-fully-rendered track; nothing is keyboard-only reachable through it.
    <div
      className="relative flex overflow-hidden"
      onMouseEnter={handlePause}
      onMouseLeave={handleResume}
      style={{
        maskImage: 'linear-gradient(to right,transparent,black 8%,black 92%,transparent)',
        WebkitMaskImage: 'linear-gradient(to right,transparent,black 8%,black 92%,transparent)',
      }}
    >
      <div ref={track} className="flex shrink-0 py-[0.5rem]">
        {cards}
        {cards}
      </div>
    </div>
  )
}
