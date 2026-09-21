'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Pencil } from 'lucide-react'

type SaveBarProps = {
  message: string
  saveLabel: string
  discardLabel: string
  onSave: () => void
  onDiscard: () => void
  saving?: boolean
}

/**
 * Contextual save bar: sticks to the top of the scrolling page while the form
 * has unsaved changes. Render it as the first child of PageBody.
 */
export default function SaveBar({
  message,
  saveLabel,
  discardLabel,
  onSave,
  onDiscard,
  saving = false,
}: SaveBarProps) {
  return (
    <div className="sticky top-2 z-20">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-card md:px-5">
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
    </div>
  )
}
