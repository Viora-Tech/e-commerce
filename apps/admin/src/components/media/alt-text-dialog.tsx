'use client'

import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type AltTextDialogProps = {
  /** The item being edited, or null to keep the dialog closed. */
  item: { id: string; url: string; alt: string | null } | null
  onClose: () => void
  onSaved: (id: string, alt: string | null) => void
}

export default function AltTextDialog({ item, onClose, onSaved }: AltTextDialogProps) {
  // Hooks
  const { altDialog: copy } = useCopy(mediaContent)
  const [alt, setAlt] = useState(item?.alt ?? '')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!item) return
    setBusy(true)
    try {
      const next = alt.trim() || null
      await api.media.update({ id: item.id, alt: next })
      onSaved(item.id, next)
      toast.success(copy.saved)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : mediaContent.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={item !== null} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          {item ? (
            // biome-ignore lint/performance/noImgElement: preview of the file being described.
            <img
              src={item.url}
              alt=""
              className="max-h-48 w-full rounded-lg border bg-muted object-contain"
            />
          ) : null}
          <Field>
            <FieldLabel htmlFor="media-alt">{copy.label}</FieldLabel>
            <Input
              id="media-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder={copy.placeholder}
              maxLength={300}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button loading={busy} type="submit" disabled={busy}>
              <Save aria-hidden="true" />
              {copy.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
