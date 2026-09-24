'use client'

import { Pencil } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { base, instant } from '@/lib/motion'

type SaveBarProps = {
  /** Render while the form is dirty; the bar slides in and out on change. */
  open: boolean
  message: string
  saveLabel: string
  discardLabel: string
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}

/**
 * Contextual save bar: sticks to the top of the scrolling page while the form
 * has unsaved changes. Render it as the first child of PageBody with `open`.
 */
export default function SaveBar({
  open,
  message,
  saveLabel,
  discardLabel,
  onSave,
  onDiscard,
  saving = false,
}: SaveBarProps) {
  // Hooks
  const reduced = useReducedMotion()

  // Render logic
  const slide = reduced ? instant : base

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="save-bar"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={slide}
          className="sticky top-14 z-10"
        >
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-popover md:px-5">
            <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-body font-semibold text-foreground">{message}</span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-w-24"
                onClick={onDiscard}
                disabled={saving}
              >
                {discardLabel}
              </Button>
              <Button type="button" className="min-w-24" onClick={onSave} disabled={saving}>
                {saving ? <Spinner /> : null}
                {saveLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
