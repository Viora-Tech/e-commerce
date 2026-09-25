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
 * Contextual save bar: a small floating pill at the bottom centre of the
 * screen while the form has unsaved changes. Render it anywhere in the page
 * (e.g. first child of PageBody) with `open`.
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
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={slide}
          className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
        >
          <div
            role="status"
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-popover py-1.5 pr-1.5 pl-3.5 shadow-popover"
          >
            <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-caption font-medium whitespace-nowrap text-foreground">
              {message}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-1 rounded-full"
              onClick={onDiscard}
              disabled={saving}
            >
              {discardLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? <Spinner /> : null}
              {saveLabel}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
