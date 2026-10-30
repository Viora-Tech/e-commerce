'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type CustomerEmailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  email: string
  /** After a send, so the page re-reads its messages and timeline. */
  onSent: () => void
}

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/**
 * "Email customer" (audit #80): a subject and a plain-text message sent through the store's own
 * email channels, instead of opening the merchant's mail app.
 */
export default function CustomerEmailDialog({
  open,
  onOpenChange,
  customerId,
  email,
  onSent,
}: CustomerEmailDialogProps) {
  // Hooks
  const { email: copy } = useCopy(customerDetailContent)
  const subjectId = useId()
  const messageId = useId()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setSubject('')
    setMessage('')
  }, [open])

  // Event handlers
  const handleSubmit = async () => {
    try {
      const r = await api.customers.sendEmail({ id: customerId, subject, message })
      toast.success(copy.sent(r.sentTo))
      onOpenChange(false)
      onSent()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
      throw err
    }
  }

  // Render logic
  const ready = subject.trim().length > 0 && message.trim().length > 0

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={`${copy.to}: ${email}`}
      submitLabel={copy.send}
      cancelLabel={copy.cancel}
      submitDisabled={!ready}
      onSubmit={handleSubmit}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor={subjectId}>{copy.subject}</FieldLabel>
          <Input
            id={subjectId}
            value={subject}
            maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
            autoFocus
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={messageId}>{copy.message}</FieldLabel>
          <Textarea
            id={messageId}
            value={message}
            maxLength={5000}
            rows={8}
            onChange={(e) => setMessage(e.target.value)}
          />
          <FieldDescription>{copy.help}</FieldDescription>
        </Field>
      </div>
    </FormDialog>
  )
}
