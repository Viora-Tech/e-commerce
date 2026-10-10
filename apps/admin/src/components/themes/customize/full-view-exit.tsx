'use client'

import { ExitFullViewIcon } from '@commerce/ui/icons'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { isFullViewShortcut, isTypingTarget, useEditorView } from '@/lib/customize-view'

/**
 * Full view's way back, and its keys: a floating "Exit full view" pill at the bottom of the
 * canvas while full view is on; `\` or Ctrl/⌘ + `.` toggles it and Esc leaves it, in the admin
 * and inside the canvas frame, never while typing.
 */
export default function FullViewExit() {
  // Hooks
  const copy = useCopy(customizeContent.view)
  const view = useEditorView()
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (isFullViewShortcut(e)) {
        e.preventDefault()
        view.setFull(!view.full)
      } else if (e.key === 'Escape' && view.full) {
        view.setFull(false)
      }
    }
    const docs = [document]
    const frame = document.querySelector('iframe')?.contentDocument
    if (frame) docs.push(frame)
    for (const doc of docs) doc.addEventListener('keydown', handleKeyDown)
    return () => {
      for (const doc of docs) doc.removeEventListener('keydown', handleKeyDown)
    }
  }, [view])

  // Render logic
  return (
    <AnimatePresence>
      {view.full ? (
        <motion.button
          type="button"
          onClick={() => view.setFull(false)}
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
          className="absolute bottom-5 left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full bg-ink-strong px-4 text-sm leading-5 font-medium text-background shadow-popover transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <ExitFullViewIcon aria-hidden weight="regular" className="size-4" />
          {copy.exitFullView}
          <kbd className="rounded bg-background/15 px-1.5 text-xs font-medium">{copy.exitHint}</kbd>
        </motion.button>
      ) : null}
    </AnimatePresence>
  )
}
