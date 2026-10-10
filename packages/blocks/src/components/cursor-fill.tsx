'use client'

import { useEffect } from 'react'
import { useReducedMotion } from '../use-reduced-motion'

/** Every control whose hover colour sweeps in from where the cursor entered. */
const FILL_TARGETS = '.btn, [data-icon-close]'

/** Only a real pointer that can hover. Touch has no hover at all (base.css gates it) and gets the :active press. */
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

function pointAt(el: Element, event: PointerEvent): { x: string; y: string } {
  const box = el.getBoundingClientRect()
  const x = ((event.clientX - box.left) / box.width) * 100
  const y = ((event.clientY - box.top) / box.height) * 100
  return { x: `${Math.round(x)}%`, y: `${Math.round(y)}%` }
}

function setOrigin(el: HTMLElement, event: PointerEvent): void {
  const { x, y } = pointAt(el, event)
  el.style.setProperty('--fill-x', x)
  el.style.setProperty('--fill-y', y)
}

/**
 * Port of Zero Drift's motion.js cursor-origin fill: buttons fill from the point the
 * cursor came in and drain toward the point it left. The sweep itself is the CSS
 * clip-path transition in base.css; this only supplies the origin and the class,
 * and marks <html> so the plain :hover swap steps aside. Renders nothing.
 */
export default function CursorFill() {
  // Hooks
  const reduce = useReducedMotion()
  useEffect(() => {
    const root = document.documentElement
    if (reduce || !window.matchMedia(FINE_POINTER).matches) {
      root.classList.remove('has-cursor-fill')
      return
    }
    const target = (event: Event) =>
      event.target instanceof HTMLElement && event.target.matches(FILL_TARGETS)
        ? event.target
        : null
    const onEnter = (event: PointerEvent) => {
      const el = target(event)
      if (!el || event.pointerType === 'touch') return
      setOrigin(el, event)
      el.classList.add('is-hover-fill')
    }
    const onLeave = (event: PointerEvent) => {
      const el = target(event)
      if (!el) return
      setOrigin(el, event)
      el.classList.remove('is-hover-fill')
    }
    root.classList.add('has-cursor-fill')
    // pointerenter/leave do not bubble, but they do pass through the capture phase.
    document.addEventListener('pointerenter', onEnter, true)
    document.addEventListener('pointerleave', onLeave, true)
    return () => {
      root.classList.remove('has-cursor-fill')
      document.removeEventListener('pointerenter', onEnter, true)
      document.removeEventListener('pointerleave', onLeave, true)
    }
  }, [reduce])

  return null
}
