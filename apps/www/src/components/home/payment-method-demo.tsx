'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { paymentDemoContent as copy, PAYMENT_METHODS } from '@/data/demo-payments'
import { prefersReducedMotion } from '@/lib/gsap'
import PaymentPanel from './payment-panel'

/**
 * A mini checkout that switches between UPI, Card, Net banking, Wallets and COD. Each method plays
 * its short flow (details, then paid or confirmed); the tile moves to the next method every few
 * seconds unless the pointer is over it, and a chip click jumps to that method. With reduced
 * motion nothing advances on its own and each panel shows its finished state.
 */
export default function PaymentMethodDemo() {
  // Hooks
  const rootRef = useRef<HTMLDivElement>(null)
  const [method, setMethod] = useState(0)
  // Ticks since this method came on screen; the step and the move to the next method follow from it.
  const [ticks, setTicks] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [inView, setInView] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    setReduced(prefersReducedMotion())
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      {
        threshold: 0.3,
      },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (reduced || hovered || !inView) return
    const timer = setInterval(() => setTicks((value) => value + 1), copy.stepMs)
    return () => clearInterval(timer)
  }, [reduced, hovered, inView])

  useEffect(() => {
    const stepCount = PAYMENT_METHODS[method]?.steps.length ?? 1
    const dwellTicks = Math.ceil(
      Math.max(copy.minDwellMs, stepCount * copy.stepMs + 900) / copy.stepMs,
    )
    if (ticks < dwellTicks) return
    setMethod((value) => (value + 1) % PAYMENT_METHODS.length)
    setTicks(0)
  }, [ticks, method])

  // Event handlers
  const handleSelect = (index: number) => {
    setMethod(index)
    setTicks(0)
  }

  // Early returns
  const current = PAYMENT_METHODS[method] ?? PAYMENT_METHODS[0]
  if (!current) return null

  // Render logic
  const lastStep = current.steps.length - 1
  const shownStep = reduced ? lastStep : Math.min(lastStep, ticks)
  const panel = current.steps[shownStep] ?? current.steps[0]
  if (!panel) return null

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only pauses the demo
    <div
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex min-h-[19rem] flex-1 flex-col gap-4 rounded-2xl border border-border bg-background p-5"
    >
      <h4 className="text-xl font-semibold text-foreground">{copy.heading}</h4>
      <div
        role="tablist"
        aria-label={copy.tablist}
        className="glass-panel flex w-fit max-w-full flex-wrap gap-1 rounded-full p-1"
      >
        {PAYMENT_METHODS.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={index === method}
            onClick={() => handleSelect(index)}
            className={cn(
              'h-8 rounded-full px-3.5 text-sm font-medium outline-none transition-colors duration-(--duration-press) ease-out focus-visible:ring-3 focus-visible:ring-ring/50',
              index === method
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-live="polite" className="flex flex-1 items-center">
        <div key={`${current.key}-${panel}`} className="animate-panel-in w-full">
          <PaymentPanel step={panel} />
        </div>
      </div>
    </div>
  )
}
