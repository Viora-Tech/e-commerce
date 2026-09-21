'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { CircleAlert } from 'lucide-react'

type SaveBarProps = {
  message: string
  saveLabel: string
  discardLabel: string
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
  /** Discard is pointless when nothing changed (e.g. a fresh "new" form). */
  canDiscard?: boolean
}

/**
 * Contextual save bar: sticks to the top of the scrolling page while the form
 * has unsaved changes. Render it as the first child of PageBody.
 */
export function SaveBar({
  message,
  saveLabel,
  discardLabel,
  onSave,
  onDiscard,
  saving = false,
  canDiscard = true,
}: SaveBarProps) {
  return (
    <div className="sticky top-2 z-20">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-card md:px-5">
        <CircleAlert className="size-5 shrink-0 text-warning" aria-hidden />
        <span className="text-body font-bold text-ink-strong">{message}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-lg px-4"
            onClick={onDiscard}
            disabled={saving || !canDiscard}
          >
            {discardLabel}
          </Button>
          <Button type="button" className="h-9 rounded-lg px-4" onClick={onSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
