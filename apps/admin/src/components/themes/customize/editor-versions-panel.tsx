'use client'

import { ExternalLink, RotateCcw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { displayThemeName } from '@/lib/customize-theme-name'
import { formatWhen } from '@/lib/format-date'
import { initials } from '@/lib/initials'
import { versionPreviewUrl } from '../theme-types'

type Batch = Awaited<ReturnType<typeof api.themes.versions.list>>[number]

type EditorVersionsPanelProps = {
  open: boolean
  theme: { id: string; name: string; role: string; previewToken: string }
  origin: string
  /** The member editing, for the "Now" row. */
  me: string
  onOpenChange: (open: boolean) => void
  /** A version became the drafts: the editor reloads the page from them. */
  onRestored: () => void
}

/**
 * Version history in a dialog over the editor (Figma 697:4526), from the bar's ⋯ menu: "Now" (the
 * current draft), then each time the theme went live, newest first, with who and when; the
 * newest of a live theme is tagged Live. Picking one offers Preview (that version of the store
 * in a new tab) and Restore (it becomes the draft; nothing goes live until Publish).
 */
export default function EditorVersionsPanel({
  open,
  theme,
  origin,
  me,
  onOpenChange,
  onRestored,
}: EditorVersionsPanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.versions)
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  useEffect(() => {
    if (!open) return
    let current = true
    setBatches(null)
    setFailed(false)
    api.themes.versions.list({ themeId: theme.id }).then(
      (next) => current && setBatches(next),
      () => current && setFailed(true),
    )
    return () => {
      current = false
    }
  }, [open, theme.id])

  // Helpers
  const tagOf = (b: Batch, i: number) =>
    theme.role === 'main' && i === 0
      ? copy.live
      : b.reason === 'publish'
        ? copy.published
        : copy.saved

  // Event handlers
  const handleRestore = async (batchId: string) => {
    setRestoring(true)
    try {
      await api.themes.versions.restore({ themeId: theme.id, batchId })
      toast.success(copy.restored)
      onOpenChange(false)
      onRestored()
    } catch {
      toast.error(copy.restoreFailed)
    } finally {
      setRestoring(false)
    }
  }

  // Render logic
  const live = theme.role === 'main'

  return (
    // A dialog, not a right-side drawer (audit #143).
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body(displayThemeName(theme.name))}</DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 flex max-h-[60vh] min-h-0 flex-col gap-1 overflow-y-auto">
          <li className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold text-foreground">
              {initials(me)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[0.8125rem] font-medium text-foreground">{copy.now}</span>
              <span className="truncate text-xs text-muted-foreground">{me}</span>
            </span>
            <StatusChip tone="attention">{copy.current}</StatusChip>
          </li>
          {failed ? (
            <li className="px-2 py-2 text-xs text-destructive">{copy.failed}</li>
          ) : batches === null ? (
            <li className="flex flex-col gap-2 px-2 py-2" aria-label={copy.loading}>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </li>
          ) : batches.length === 0 ? (
            <li className="px-2 py-2 text-xs text-muted-foreground">{copy.empty}</li>
          ) : (
            batches.map((b, i) => {
              const selected = picked === b.batchId
              return (
                <li
                  key={b.batchId}
                  className={cn('flex flex-col gap-2 rounded-lg', selected && 'bg-muted p-2')}
                >
                  <button
                    type="button"
                    onClick={() => setPicked(selected ? null : b.batchId)}
                    aria-expanded={selected}
                    className={cn(
                      'flex items-center gap-3 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? '' : 'px-2 py-2 hover:bg-muted/60',
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold text-foreground ring-1 ring-border">
                      {initials(b.createdBy)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[0.8125rem] font-medium text-foreground">
                        {formatWhen(b.createdAt)}
                      </span>
                      {b.createdBy ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {b.createdBy}
                        </span>
                      ) : null}
                    </span>
                    <StatusChip tone={live && i === 0 ? 'success' : 'neutral'}>
                      {tagOf(b, i)}
                    </StatusChip>
                  </button>
                  {selected ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        title={copy.previewHelp}
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
                      <Button
                        size="sm"
                        onClick={() => void handleRestore(b.batchId)}
                        disabled={restoring}
                      >
                        {restoring ? <Spinner /> : <RotateCcw aria-hidden="true" />}
                        {copy.restore}
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
