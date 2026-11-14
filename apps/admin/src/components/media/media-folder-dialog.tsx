'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { MediaFolder } from './use-media-folders'

type MediaFolderDialogProps = {
  /** The folder to rename; null makes a new one. */
  folder: MediaFolder | null
  onClose: () => void
  /** The folder as saved, new or renamed. */
  onSaved: (folder: { id: string; name: string }) => void
}

/** Names a new folder or renames one: a centred dialog, buttons on the right. Keyed by the caller. */
export default function MediaFolderDialog({ folder, onClose, onSaved }: MediaFolderDialogProps) {
  // Hooks
  const { folders: copy } = useCopy(mediaContent)
  const [name, setName] = useState(folder?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const next = name.trim()
    if (!next) return
    setBusy(true)
    setError(null)
    try {
      const saved = folder
        ? await api.media.renameFolder({ id: folder.id, name: next })
        : await api.media.createFolder({ name: next })
      toast.success(folder ? copy.renamed : copy.created)
      onSaved(saved)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const unchanged = folder !== null && name.trim() === folder.name

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{folder ? copy.renameTitle : copy.createTitle}</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="media-folder-name">{copy.nameLabel}</FieldLabel>
            <Input
              id="media-folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={copy.namePlaceholder}
              maxLength={60}
              autoComplete="off"
              autoFocus
            />
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button loading={busy} type="submit" disabled={busy || !name.trim() || unchanged}>
              {folder ? copy.save : copy.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
