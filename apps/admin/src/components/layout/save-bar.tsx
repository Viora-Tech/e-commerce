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
    <div className="sticky top-0 z-20 -mx-4 -mt-4 md:-mx-6 md:-mt-6">
      <div className="flex items-center gap-3 border-b bg-foreground px-4 py-2 text-background shadow-sm md:px-6">
        <CircleAlert className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="text-sm font-medium">{message}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-background hover:bg-background/10 hover:text-background"
            onClick={onDiscard}
            disabled={saving || !canDiscard}
          >
            {discardLabel}
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saving}>
            {saving ? <Spinner /> : null}
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
