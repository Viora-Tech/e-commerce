'use client'

import { CancelCircle } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { returnDetailContent } from '@/data/returns'
import { api } from '@/lib/api-client'

type RejectDialogProps = {
  returnId: string
  open: boolean
  onClose: () => void
  onDone: () => void
}

const copy = returnDetailContent.rejectDialog

/** Decline with a reason the customer reads. */
export default function RejectDialog({ returnId, open, onClose, onDone }: RejectDialogProps) {
  // Hooks
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    try {
      await api.returns.reject({ id: returnId, note: note.trim() })
      toast.success(copy.done)
      setNote('')
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : returnDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="reject-note">{copy.label}</FieldLabel>
            <Textarea
              id="reject-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={copy.placeholder}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {returnDetailContent.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !note.trim()}>
              <CancelCircle aria-hidden="true" />
              {copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
