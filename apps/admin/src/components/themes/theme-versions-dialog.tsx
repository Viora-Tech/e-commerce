'use client'

import { ExternalLink, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatWhen } from '@/lib/format-date'
import { type ThemeItem, versionPreviewUrl } from './theme-types'

type ThemeVersionsDialogProps = {
  /** The theme whose history is open. Mount per theme (`key`). */
  theme: ThemeItem
  origin: string
  onClose: () => void
  /** A version was restored into the drafts (the library shows "Unsaved changes"). */
  onRestored: () => void
}

type Batch = Awaited<ReturnType<typeof api.themes.versions.list>>[number]

/**
 * Version history from the theme's ⋯ menu: every time it went live (published, or saved while
 * live), newest first, each with Preview (a storefront preview of that version) and Restore
 * (into the drafts; nothing reaches shoppers until the merchant saves).
 */
export default function ThemeVersionsDialog({
  theme,
  origin,
  onClose,
  onRestored,
}: ThemeVersionsDialogProps) {
  // Hooks
  const copy = useCopy(themesContent.versionsDialog)
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirming, setConfirming] = useState<Batch | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api.themes.versions.list({ themeId: theme.id }).then(
      (next) => active && setBatches(next),
      () => active && setFailed(true),
    )
    return () => {
      active = false
    }
  }, [theme.id])

  // Event handlers
  const handleRestore = async () => {
    if (!confirming) return
    setBusy(true)
    try {
      await api.themes.versions.restore({ themeId: theme.id, batchId: confirming.batchId })
      toast.success(copy.restored)
      setConfirming(null)
      onRestored()
    } catch {
      toast.error(copy.restoreFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.title(theme.name)}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          {failed ? <p className="text-body text-destructive">{copy.failed}</p> : null}
          {!batches && !failed ? (
            <p className="text-body text-muted-foreground">{copy.loading}</p>
          ) : null}
          {batches && batches.length === 0 ? (
            <EmptyState variant="dashed" size="sm" body={copy.empty} />
          ) : null}
          {batches && batches.length > 0 ? (
            <ul className="-mx-1 flex max-h-[26rem] flex-col divide-y divide-border overflow-y-auto px-1">
              {batches.map((b) => (
                <li key={b.batchId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                  <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="text-body font-medium text-foreground">
                        {formatWhen(b.createdAt)}
                      </span>
                      <StatusChip className="h-5 px-2">
                        {b.reason === 'publish' ? copy.published : copy.saved}
                      </StatusChip>
                    </span>
                    <span className="text-caption font-normal text-muted-foreground">
                      {copy.pages(b.templates.length)}
                      {b.createdBy ? ` · ${copy.by(b.createdBy)}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={
                        <a
                          href={versionPreviewUrl(origin, theme.previewToken, b.batchId)}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <ExternalLink aria-hidden />
                      {copy.preview}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirming(b)}>
                      <RotateCcw aria-hidden="true" />
                      {copy.restore}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={copy.confirmTitle}
        body={copy.confirmBody}
        confirmLabel={busy ? copy.restoring : copy.restore}
        cancelLabel={copy.cancel}
        tone="default"
        busy={busy}
        onConfirm={handleRestore}
      />
    </>
  )
}
