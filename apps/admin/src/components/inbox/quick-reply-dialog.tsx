'use client'

import { normaliseShortcut } from '@commerce/core/inbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { inboxContent } from '@/data/inbox'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type QuickReply = { id: string; title: string; body: string; shortcut: string }

type QuickReplyDialogProps = {
  /** The reply being changed; null adds a new one. */
  reply: QuickReply | null
  onClose: () => void
  onSaved: () => void
}

/** Add or change a quick reply: a title, a `/shortcut` and the message. */
export default function QuickReplyDialog({ reply, onClose, onSaved }: QuickReplyDialogProps) {
  // Hooks
  const copy = useCopy(inboxContent)
  const [title, setTitle] = useState(reply?.title ?? '')
  const [shortcut, setShortcut] = useState(reply?.shortcut ?? '')
  const [body, setBody] = useState(reply?.body ?? '')

  // Event handlers
  const handleSubmit = async () => {
    const d = copy.quickReplies.dialog
    const normalised = normaliseShortcut(shortcut)
    if (!title.trim() || !body.trim() || !normalised) {
      toast.error(d.invalid)
      throw new Error(d.invalid)
    }
    try {
      if (reply) {
        await api.inbox.quickReplies.update({ id: reply.id, title, body, shortcut: normalised })
      } else {
        await api.inbox.quickReplies.create({ title, body, shortcut: normalised })
      }
      toast.success(copy.quickReplies.saved)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  const d = copy.quickReplies.dialog

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={reply ? d.editTitle : d.addTitle}
      submitLabel={reply ? d.save : d.add}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="quick-reply-title">{d.title}</FieldLabel>
          <Input
            id="quick-reply-title"
            maxLength={80}
            placeholder={d.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-reply-shortcut">{d.shortcut}</FieldLabel>
          <Input
            id="quick-reply-shortcut"
            maxLength={33}
            className="font-mono"
            placeholder="delivery"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
          />
          <FieldDescription>{d.shortcutHelp}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="quick-reply-body">{d.body}</FieldLabel>
          <Textarea
            id="quick-reply-body"
            rows={4}
            maxLength={2000}
            placeholder={d.bodyPlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
      </div>
    </FormDialog>
  )
}
