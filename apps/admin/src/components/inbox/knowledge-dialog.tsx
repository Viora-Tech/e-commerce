'use client'

import { KNOWLEDGE_ANSWER_MAX, KNOWLEDGE_TITLE_MAX } from '@commerce/core/inbox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { inboxKnowledgeContent } from '@/data/inbox-knowledge'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

export type KnowledgeEntry = {
  id: string
  title: string
  answer: string
  published: boolean
  imported: boolean
}

type KnowledgeDialogProps = {
  /** The answer being changed; null adds a new one. */
  entry: KnowledgeEntry | null
  onClose: () => void
  onSaved: () => void
}

/** Add or change a knowledge base answer: the question, the answer and whether the AI may use it. */
export default function KnowledgeDialog({ entry, onClose, onSaved }: KnowledgeDialogProps) {
  // Hooks
  const copy = useCopy(inboxKnowledgeContent)
  const [title, setTitle] = useState(entry?.title ?? '')
  const [answer, setAnswer] = useState(entry?.answer ?? '')
  const [published, setPublished] = useState(entry?.published ?? true)

  // Event handlers
  const handleSubmit = async () => {
    const d = copy.dialog
    if (!title.trim() || !answer.trim()) {
      toast.error(d.invalid)
      throw new Error(d.invalid)
    }
    try {
      if (entry) {
        await api.inbox.knowledge.update({ id: entry.id, title, answer, published })
      } else {
        await api.inbox.knowledge.create({ title, answer, published })
      }
      toast.success(copy.saved)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      throw err
    }
  }

  // Render logic
  const d = copy.dialog

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={entry ? d.editTitle : d.addTitle}
      submitLabel={entry ? d.save : d.add}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="knowledge-title">{d.title}</FieldLabel>
          <Input
            id="knowledge-title"
            maxLength={KNOWLEDGE_TITLE_MAX}
            placeholder={d.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="knowledge-answer">{d.answer}</FieldLabel>
          <Textarea
            id="knowledge-answer"
            rows={5}
            maxLength={KNOWLEDGE_ANSWER_MAX}
            placeholder={d.answerPlaceholder}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <FieldDescription>{d.answerHelp}</FieldDescription>
        </Field>
        <Field orientation="horizontal" className="items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="knowledge-published">{d.published}</FieldLabel>
            <FieldDescription>{d.publishedHelp}</FieldDescription>
          </div>
          <Switch id="knowledge-published" checked={published} onCheckedChange={setPublished} />
        </Field>
      </div>
    </FormDialog>
  )
}
