'use client'

// Adapted from Aceternity UI Focus Cards (Aceternity UI licence, free component; builder use
// permitted by the owner, see docs/licences/aceternity-pro.md), https://ui.aceternity.com/components/focus-cards.
// Same behaviour as the original: while one card is hovered, every other card blurs and
// shrinks a little (`blur-sm scale-[0.98]`, 300ms ease-out). Changes: it wraps the caller's own
// cards (direct children, any markup, server-rendered) instead of drawing image cards itself,
// finds the hovered one by event delegation, reacts to a mouse only (touch taps never leave the
// others blurred), and skips the transition under reduced motion.
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { cx } from '../slot-types'

type FocusCardsProps = {
  /** The cards; each direct child is one card. */
  children: ReactNode
  /** Classes for the grid that holds the cards. */
  className?: string | undefined
}

const DIM = 'data-focus-dim'

/** Index of the direct child of `box` that holds `target`, or null. */
function cardIndex(box: HTMLElement, target: EventTarget | null): number | null {
  let node = target instanceof Element ? target : null
  while (node && node.parentElement !== box) node = node.parentElement
  return node ? Array.prototype.indexOf.call(box.children, node) : null
}

export default function FocusCards({ children, className }: FocusCardsProps) {
  // Hooks
  const [hovered, setHovered] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el) return
    Array.from(el.children).forEach((card, i) => {
      card.toggleAttribute(DIM, hovered !== null && hovered !== i)
    })
  }, [hovered])

  // Event handlers
  const handlePointerOver = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse' || !box.current) return
    setHovered(cardIndex(box.current, event.target))
  }
  const handlePointerLeave = () => setHovered(null)

  return (
    <div
      ref={box}
      className={cx(
        'motion-safe:[&>*]:transition-[filter,scale] motion-safe:[&>*]:duration-300 motion-safe:[&>*]:ease-out',
        '[&>[data-focus-dim]]:scale-[0.98] [&>[data-focus-dim]]:blur-sm',
        className,
      )}
      onPointerOver={handlePointerOver}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </div>
  )
}
