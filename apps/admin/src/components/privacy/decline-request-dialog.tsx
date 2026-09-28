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
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { type FormEvent, useState } from 'react'
import { dataRequestDetailContent as copy } from '@/data/customer-privacy'

type DeclineRequestDialogProps = {
  open: boolean
  busy: boolean
  onClose: () => void
  onDecline: (reason: string) => void
}

/** Decline a data request with a reason the customer could be told. */
export default function DeclineRequestDialog({
  open,
  busy,
  onClose,
  onDecline,
}: DeclineRequestDialogProps) {
  // Hooks
  const [reason, setReason] = useState('')

  // Event handlers
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (reason.trim()) onDecline(reason.trim())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{copy.declineTitle}</DialogTitle>
            <DialogDescription>{copy.declineBody}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="decline-reason">{copy.declineReason}</FieldLabel>
            <Textarea
              id="decline-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy || !reason.trim()}>
              {copy.declineConfirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
