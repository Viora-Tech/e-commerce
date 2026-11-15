'use client'

import { ExternalLink, Pencil, RotateCcw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import StatusChip from '@/components/layout/status-chip'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { displayThemeName } from '@/lib/customize-theme-name'
import { formatWhen } from '@/lib/format-date'
import { initials } from '@/lib/initials'
import { versionPreviewUrl } from './theme-types'

type Batch = Awaited<ReturnType<typeof api.themes.versions.list>>[number]

type ThemeVersionHistoryProps = {
  open: boolean
  theme: { id: string; name: string; role: string; previewToken: string }
  origin: string
  /**
   * Where it opens. `editor`: the "Now" row is the member editing (`me`). `library`: there is
   * no open editor, so "Now" shows only when the theme has unsaved drafts (`hasDraft`).
   */
  where: 'editor' | 'library'
  /** The member editing (editor only). */
  me?: string
  /** The theme holds unsaved drafts (library only). */
  hasDraft?: boolean
  onOpenChange: (open: boolean) => void
  /** A version became the drafts: the editor reloads them, the library shows "Unsaved changes". */
  onRestored: () => void
}

const AVATAR =
  'flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-micro font-semibold text-foreground'

/**
 * Version history (Figma 697:4526), the one design for the theme library's ⋯ menu and the
 * editor's: "Now" (the current drafts) first, then each time the theme went live, newest first,
 * with who and when; the newest of a live theme is tagged Live. Picking a row offers Preview
 * (that version of the store in a new tab) and Restore (its pages become the drafts; nothing
 * goes live until Publish, so there is no confirm step).
 */
export default function ThemeVersionHistory({
  open,
  theme,
  origin,
  where,
  me,
  hasDraft = false,
  onOpenChange,
  onRestored,
}: ThemeVersionHistoryProps) {
  // Hooks
  const copy = useCopy(themesContent.versionHistory)
  const [batches, setBatches] = useState<Batch[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  useEffect(() => {
    if (!open) return
    let current = true
    setBatches(null)
    setFailed(false)
    setPicked(null)
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
      toast.success(copy.restored[where])
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
  const showNow = where === 'editor' || hasDraft
  const nowLine = where === 'editor' ? (me ?? '') : copy.unsavedDrafts

  return (
    // A dialog, not a right-side drawer (audit #143).
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent busy={restoring}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body(displayThemeName(theme.name))}</DialogDescription>
        </DialogHeader>
        <ul className="-mx-2 flex max-h-[60vh] min-h-0 flex-col gap-1 overflow-y-auto">
          {showNow ? (
            <li className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className={AVATAR}>
                {where === 'editor' ? (
                  initials(me ?? null)
                ) : (
                  <Pencil aria-hidden className="size-3.5" />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-caption font-medium text-foreground">{copy.now}</span>
                <span className="truncate text-period text-muted-foreground">{nowLine}</span>
              </span>
              <StatusChip tone="attention">{copy.current}</StatusChip>
            </li>
          ) : null}
          {failed ? (
            <li className="px-2 py-2 text-period text-destructive">{copy.failed}</li>
          ) : batches === null ? (
            <li className="flex flex-col gap-2 px-2 py-2" aria-label={copy.loading}>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </li>
          ) : batches.length === 0 ? (
            <li className="px-2 py-2 text-period text-muted-foreground">{copy.empty}</li>
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
                    <span className={cn(AVATAR, 'ring-1 ring-border')}>
                      {initials(b.createdBy)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-caption font-medium text-foreground">
                        {formatWhen(b.createdAt)}
                      </span>
                      {b.createdBy ? (
                        <span className="truncate text-period text-muted-foreground">
                          {b.createdBy}
                        </span>
                      ) : null}
                    </span>
                    <StatusChip tone={live && i === 0 ? 'success' : 'neutral'}>
                      {tagOf(b, i)}
                    </StatusChip>
                  </button>
                  {selected ? (
                    <>
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
                          loading={restoring}
                          size="sm"
                          onClick={() => void handleRestore(b.batchId)}
                          disabled={restoring}
                        >
                          <RotateCcw aria-hidden="true" />
                          {copy.restore}
                        </Button>
                      </div>
                      <p className="text-period text-muted-foreground">{copy.restoreNote}</p>
                    </>
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
