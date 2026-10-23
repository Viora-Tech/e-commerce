'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useState } from 'react'
import SlideAsk from '@/components/auth/slide-ask'
import SlideInvoice from '@/components/auth/slide-invoice'
import SlideOrders from '@/components/auth/slide-orders'
import SlideShip from '@/components/auth/slide-ship'
import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'

const SLIDES = [
  { id: 'orders', Slide: SlideOrders },
  { id: 'ask', Slide: SlideAsk },
  { id: 'invoice', Slide: SlideInvoice },
  { id: 'ship', Slide: SlideShip },
]
/** Time on each slide: long enough to read the headline and the card (owner: 5s felt rushed). */
const ADVANCE_MS = 8000

/**
 * The brand panel: a soft blue gradient with a faint grid and four illustrated slides that
 * fade and rise in. Auto-advances every 5 s and pauses on hover or focus. With reduced
 * motion it stays on slide 1 (the dots still switch slides by hand, without animation).
 */
export default function LoginPanel() {
  // Hooks
  const { panel } = useCopy(loginContent)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced, setReduced] = useState(true)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (paused || reduced) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), ADVANCE_MS)
    return () => clearInterval(timer)
  }, [paused, reduced])

  return (
    <section
      aria-roledescription="carousel"
      aria-label={panel.label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative hidden overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary-tint via-primary-soft to-primary/30 lg:block"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-8 p-10">
        <div className="relative h-72 w-80">
          {SLIDES.map(({ id, Slide }, i) => (
            <div
              key={id}
              aria-hidden={i !== index}
              className={cn(
                'absolute inset-0 flex items-center justify-center transition-[opacity,translate] duration-[400ms] ease-out motion-reduce:transition-none',
                i === index
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-3 opacity-0',
              )}
            >
              <Slide />
            </div>
          ))}
        </div>
        <div
          className="flex h-24 max-w-sm flex-col items-center gap-1.5 text-center"
          aria-live="polite"
        >
          <h2 className="font-display text-kit-heading text-ink-strong">
            {panel.slides[index]?.title}
          </h2>
          <p className="text-body text-helper">{panel.slides[index]?.body}</p>
        </div>
        <div className="flex items-center gap-2">
          {SLIDES.map(({ id }, i) => (
            <button
              key={id}
              type="button"
              aria-label={panel.dot(i + 1)}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'h-2 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none',
                i === index ? 'w-6 bg-primary' : 'w-2 bg-primary/30 hover:bg-primary/50',
              )}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
