'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { MediaFolder } from './use-media-folders'

type MoveToFolderDialogProps = {
  /** The file being moved: its id, display name and current folder. */
  file: { id: string; name: string; folderId: string | null }
  folders: MediaFolder[]
  onClose: () => void
  /** Moved: the file's new folder (null for none). */
  onMoved: (id: string, folderId: string | null) => void
}

const NONE = 'none'

/** "Move to folder" on a file (#91): pick a folder or none. Keyed by the caller. */
export default function MoveToFolderDialog({
  file,
  folders,
  onClose,
  onMoved,
}: MoveToFolderDialogProps) {
  // Hooks
  const { folders: copy } = useCopy(mediaContent)
  const [target, setTarget] = useState(file.folderId ?? NONE)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const folderId = target === NONE ? null : target
    setBusy(true)
    try {
      await api.media.moveToFolder({ ids: [file.id], folderId })
      const name = folders.find((f) => f.id === folderId)?.name ?? copy.noFolder
      toast.success(copy.moved(name))
      onMoved(file.id, folderId)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const unchanged = target === (file.folderId ?? NONE)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.moveTitle}</DialogTitle>
            <DialogDescription>{copy.moveBody(file.name)}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="media-move-folder">{copy.moveTarget}</FieldLabel>
            <NativeSelect
              id="media-move-folder"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <NativeSelectOption value={NONE}>{copy.noFolder}</NativeSelectOption>
              {folders.map((f) => (
                <NativeSelectOption key={f.id} value={f.id}>
                  {f.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy || unchanged}>
              {copy.move}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
