'use client'

import { Copy, Eye, EyeOff, MoreHorizontal } from '@commerce/ui/icons'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { customizeContent } from '@/data/customize'

type BlockToolbarMoreProps = {
  label: string
  hidden: boolean
  onToggleHidden: () => void
  onCopy: () => void
}

const copy = customizeContent.toolbar

const ITEM =
  'flex h-8 w-full items-center gap-2 rounded-md border-0! bg-transparent! px-2 text-left text-xs text-popover-foreground! transition-colors duration-150 hover:bg-accent! focus-visible:bg-accent! focus-visible:outline-none motion-reduce:transition-none'

/**
 * The toolbar's "more" button and its small menu: hide or show the block on the page, and
 * copy it (paste with Cmd/Ctrl+V, `customize-hotkeys.tsx`). Drawn inside the toolbar rather
 * than portalled, so it sits on the canvas with the bar and never leaves the preview.
 */
export default function BlockToolbarMore({
  label,
  hidden,
  onToggleHidden,
  onCopy,
}: BlockToolbarMoreProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  // A press anywhere outside the menu closes it.
  useEffect(() => {
    if (!open) return
    const doc = root.current?.ownerDocument
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    doc?.addEventListener('pointerdown', close, true)
    return () => doc?.removeEventListener('pointerdown', close, true)
  }, [open])

  // Event handlers
  const handlePick = (action: () => void) => {
    action()
    setOpen(false)
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={copy.more(label)}
        title={copy.more(label)}
        className="flex size-6 shrink-0 items-center justify-center rounded-[0.375rem] border-0! bg-transparent! p-0! text-foreground/80! transition-colors duration-150 hover:bg-accent! hover:text-foreground! focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-expanded:bg-accent! aria-expanded:text-foreground! motion-reduce:transition-none"
      >
        <MoreHorizontal aria-hidden weight="regular" className="size-3.5" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="menu"
            onKeyDown={handleKeyDown}
            aria-label={copy.more(label)}
            initial={reducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
            className="glass-popover absolute top-[calc(100%+0.375rem)] right-0 z-20 flex w-44 flex-col rounded-[0.625rem] border border-glass-border p-1"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => handlePick(onToggleHidden)}
              className={ITEM}
            >
              {hidden ? (
                <Eye aria-hidden weight="regular" className="size-3.5 text-muted-foreground" />
              ) : (
                <EyeOff aria-hidden weight="regular" className="size-3.5 text-muted-foreground" />
              )}
              {hidden ? copy.show : copy.hide}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => handlePick(onCopy)}
              className={ITEM}
            >
              <Copy aria-hidden weight="regular" className="size-3.5 text-muted-foreground" />
              {copy.copy}
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
