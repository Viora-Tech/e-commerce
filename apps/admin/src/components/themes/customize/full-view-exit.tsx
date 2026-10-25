'use client'

import { Cursor, ExitFullViewIcon, Pencil } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { useCustomizePuck } from '@/lib/customize-puck'
import { isFullViewShortcut, isTypingTarget, useEditorView } from '@/lib/customize-view'

const SEGMENT =
  'flex h-7 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] leading-5 font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none'

/**
 * Full view's controls and keys: a floating pill at the bottom of the page while full view is
 * on. Full view opens in Preview (Puck's interactive mode: a click works like on the live
 * store); Edit goes back to picking sections without leaving full view. "Exit full view", `\`
 * or Ctrl/⌘ + `.` toggle full view and Esc leaves it, in the admin and inside the canvas frame,
 * never while typing.
 */
export default function FullViewExit() {
  // Hooks
  const copy = useCopy(customizeContent.view)
  const view = useEditorView()
  const reducedMotion = useReducedMotion()
  const previewMode = useCustomizePuck((s) => s.appState.ui.previewMode)
  const dispatch = useCustomizePuck((s) => s.dispatch)

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
    // The canvas frame swaps its document when it loads, which drops listeners on the old one,
    // so the frame's listener is attached again on every load.
    const iframe = document.querySelector('iframe')
    let frameDoc: Document | null = null
    const attachFrame = () => {
      frameDoc?.removeEventListener('keydown', handleKeyDown)
      frameDoc = iframe?.contentDocument ?? null
      frameDoc?.addEventListener('keydown', handleKeyDown)
    }
    document.addEventListener('keydown', handleKeyDown)
    attachFrame()
    iframe?.addEventListener('load', attachFrame)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      frameDoc?.removeEventListener('keydown', handleKeyDown)
      iframe?.removeEventListener('load', attachFrame)
    }
  }, [view])

  // Event handlers
  const handleMode = (next: 'interactive' | 'edit') =>
    dispatch({ type: 'setUi', ui: { previewMode: next } })

  // Render logic
  const modes = [
    { value: 'interactive' as const, label: copy.preview, hint: copy.previewHint, icon: Cursor },
    { value: 'edit' as const, label: copy.edit, hint: copy.editHint, icon: Pencil },
  ]

  return (
    <AnimatePresence>
      {view.full ? (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
          className="absolute bottom-5 left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-1 rounded-full bg-ink-strong p-1 text-background shadow-popover"
        >
          <fieldset
            aria-label={copy.modeLabel}
            className="m-0 flex items-center gap-0.5 border-0 p-0"
          >
            {modes.map(({ value, label, hint, icon: Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={previewMode === value}
                title={hint}
                onClick={() => handleMode(value)}
                className={cn(
                  SEGMENT,
                  previewMode === value
                    ? 'bg-background/15 text-background'
                    : 'text-background/65 hover:text-background',
                )}
              >
                <Icon aria-hidden weight="regular" className="size-4" />
                {label}
              </button>
            ))}
          </fieldset>
          <span aria-hidden className="h-4 w-px bg-background/20" />
          <button
            type="button"
            onClick={() => view.setFull(false)}
            className={cn(SEGMENT, 'text-background hover:bg-background/10')}
          >
            <ExitFullViewIcon aria-hidden weight="regular" className="size-4" />
            {copy.exitFullView}
            <kbd className="rounded bg-background/15 px-1.5 text-xs font-medium">
              {copy.exitHint}
            </kbd>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
