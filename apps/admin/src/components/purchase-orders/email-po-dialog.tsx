'use client'

import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { purchaseOrderFormContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'

export type EmailPoRequest = { to: string; message: string; markOrdered: boolean }

type EmailPoDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The supplier's email on the order, if any. */
  defaultTo: string
  /** A draft: offer to mark it ordered in the same step. */
  draft: boolean
  busy: boolean
  onSend: (request: EmailPoRequest) => void
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "Email to supplier": who it goes to, an optional note, and (drafts) mark it ordered too. */
export default function EmailPoDialog({
  open,
  onOpenChange,
  defaultTo,
  draft,
  busy,
  onSend,
}: EmailPoDialogProps) {
  // Hooks
  const { email: copy } = useCopy(purchaseOrderFormContent)
  const [to, setTo] = useState(defaultTo)
  const [message, setMessage] = useState('')
  const [markOrdered, setMarkOrdered] = useState(true)

  useEffect(() => {
    if (!open) return
    setTo(defaultTo)
    setMessage('')
    setMarkOrdered(true)
  }, [open, defaultTo])

  // Event handlers
  const handleSend = () => onSend({ to: to.trim(), message: message.trim(), markOrdered })

  // Render logic
  const valid = EMAIL.test(to.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="po-email-to">{copy.to}</FieldLabel>
          <Input
            id="po-email-to"
            type="email"
            autoComplete="off"
            value={to}
            aria-invalid={(to.trim() !== '' && !valid) || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="po-email-message">{copy.message}</FieldLabel>
          <Textarea
            id="po-email-message"
            rows={3}
            maxLength={2000}
            placeholder={copy.messagePlaceholder}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        {draft ? (
          <Field orientation="horizontal" className="items-start">
            <Checkbox
              id="po-email-mark"
              checked={markOrdered}
              onCheckedChange={(v) => setMarkOrdered(Boolean(v))}
            />
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor="po-email-mark">{copy.markOrdered}</FieldLabel>
              <FieldDescription>{copy.markOrderedHint}</FieldDescription>
            </div>
          </Field>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {copy.cancel}
          </Button>
          <Button type="button" onClick={handleSend} disabled={busy || !valid}>
            <Send aria-hidden="true" />
            {busy ? copy.sending : copy.send}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
