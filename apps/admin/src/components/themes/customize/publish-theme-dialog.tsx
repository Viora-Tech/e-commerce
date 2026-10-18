'use client'

import { ArrowRight, Clock, TriangleAlert } from '@commerce/ui/icons'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { displayThemeName } from '@/lib/customize-theme-name'

type PublishThemeDialogProps = {
  open: boolean
  /** The theme being published. */
  name: string
  /** The theme live now, if the store has one. */
  liveName: string | null
  domain: string
  /** Unsaved changes: they are saved first, and the button says so. */
  dirty: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

/**
 * Publish confirmation (Figma 697:3994): names both themes and the store's address before the
 * live theme is replaced. With unsaved changes the action is "Save and publish".
 */
export default function PublishThemeDialog({
  open,
  name,
  liveName,
  domain,
  dirty,
  onOpenChange,
  onConfirm,
}: PublishThemeDialogProps) {
  // Hooks
  const copy = useCopy(customizeContent.publishDialog)

  // Render logic
  const shown = displayThemeName(name)
  const live = liveName ? displayThemeName(liveName) : null

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title(shown)}
      body={live ? copy.body(live, domain) : copy.bodyNoLive(domain)}
      confirmLabel={dirty ? copy.saveAndPublish : copy.publish}
      cancelLabel={copy.cancel}
      tone="default"
      onConfirm={onConfirm}
    >
      <div className="flex flex-col gap-3">
        {live ? (
          <div className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-caption text-muted-foreground">{copy.liveNow}</span>
              <span className="truncate text-body text-foreground">{live}</span>
            </div>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-caption text-muted-foreground">{copy.after}</span>
              <span className="truncate text-body text-foreground">{shown}</span>
            </div>
          </div>
        ) : null}
        {dirty ? (
          <p className="flex items-center gap-2 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-caption text-warning">
            <TriangleAlert aria-hidden className="size-4 shrink-0" />
            {copy.saveFirst}
          </p>
        ) : null}
        <p className="flex items-center gap-2 text-caption text-muted-foreground">
          <Clock aria-hidden className="size-4 shrink-0" />
          {copy.goBack}
        </p>
      </div>
    </ConfirmDialog>
  )
}
