'use client'

import { Folder, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import MediaFolderDialog from './media-folder-dialog'
import type { MediaFolder } from './use-media-folders'

type MediaFolderBarProps = {
  folders: MediaFolder[]
  /** The folder being browsed; null is every file. */
  active: string | null
  /** Files in the store, for the "All files" chip. */
  total: number
  onSelect: (folderId: string | null) => void
  /** A folder was made, renamed or deleted: read the list again. */
  onChanged: () => void
}

const CHIP =
  'motion-press inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-body transition-[background-color,border-color,color]'

/**
 * Files folders (#91): "All files", one chip per folder with its count, and New folder. The
 * open folder's ⋯ renames it or deletes it; only an empty folder can go.
 */
export default function MediaFolderBar({
  folders,
  active,
  total,
  onSelect,
  onChanged,
}: MediaFolderBarProps) {
  // Hooks
  const { folders: copy } = useCopy(mediaContent)
  /** The naming dialog: `new`, the folder being renamed, or closed. */
  const [naming, setNaming] = useState<MediaFolder | 'new' | null>(null)
  const [deleting, setDeleting] = useState<MediaFolder | null>(null)

  // Event handlers
  const handleSaved = (saved: { id: string }) => {
    onChanged()
    if (naming === 'new') onSelect(saved.id)
  }

  const handleDelete = async () => {
    if (!deleting) return
    if (deleting.files > 0) {
      toast.error(copy.notEmpty(deleting.files))
      return
    }
    try {
      await api.media.deleteFolder({ id: deleting.id })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      throw err
    }
    toast.success(copy.deleted)
    if (active === deleting.id) onSelect(null)
    onChanged()
  }

  // Render logic
  const chip = (on: boolean) =>
    cn(
      CHIP,
      on
        ? 'border-primary bg-primary-soft text-ink-strong'
        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
    )

  return (
    <nav aria-label={copy.label} className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={chip(active === null)}
        aria-pressed={active === null}
        onClick={() => onSelect(null)}
      >
        {copy.all}
        <span className="text-caption tabular-nums">{copy.count(total)}</span>
      </button>
      {folders.map((folder) => {
        const on = active === folder.id
        return (
          <span key={folder.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              className={chip(on)}
              aria-pressed={on}
              onClick={() => onSelect(folder.id)}
            >
              <Folder aria-hidden="true" className="size-4" />
              {folder.name}
              <span className="text-caption tabular-nums">{copy.count(folder.files)}</span>
            </button>
            {on ? (
              <ActionMenu
                label={copy.menu(folder.name)}
                size="sm"
                items={[
                  { label: copy.rename, onSelect: () => setNaming(folder) },
                  { label: copy.delete, onSelect: () => setDeleting(folder), destructive: true },
                ]}
              />
            ) : null}
          </span>
        )
      })}
      <Button type="button" variant="ghost" size="sm" onClick={() => setNaming('new')}>
        <Plus aria-hidden="true" />
        {copy.newFolder}
      </Button>
      {naming ? (
        <MediaFolderDialog
          key={naming === 'new' ? 'new' : naming.id}
          folder={naming === 'new' ? null : naming}
          onClose={() => setNaming(null)}
          onSaved={handleSaved}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          title={copy.deleteTitle(deleting.name)}
          body={deleting.files > 0 ? copy.notEmpty(deleting.files) : copy.deleteBody}
          confirmLabel={copy.delete}
          cancelLabel={copy.cancel}
          tone="destructive"
          confirmDisabled={deleting.files > 0}
          onConfirm={handleDelete}
        />
      ) : null}
    </nav>
  )
}
