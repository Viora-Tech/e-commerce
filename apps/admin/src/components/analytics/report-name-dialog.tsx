'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import FormDialog from '@/components/layout/form-dialog'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'

type ReportNameDialogProps = {
  title: string
  description?: string | undefined
  confirm: string
  /** The name the box starts with. */
  initialName: string
  onCancel: () => void
  /** Resolves when saved; the dialog shows a spinner meanwhile. */
  onConfirm: (name: string) => Promise<void>
}

/** Names a saved report: "Save report" on a report, and Rename on a saved one. */
export default function ReportNameDialog({
  title,
  description,
  confirm,
  initialName,
  onCancel,
  onConfirm,
}: ReportNameDialogProps) {
  // Hooks
  const copy = useCopy(analyticsContent.reports.save)
  const [name, setName] = useState(initialName)

  // Event handlers
  const handleSubmit = async () => {
    if (!name.trim()) return
    await onConfirm(name.trim())
  }

  // Render logic
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={title}
      description={description}
      submitLabel={confirm}
      cancelLabel={copy.cancel}
      submitDisabled={!name.trim()}
      onSubmit={handleSubmit}
    >
      <Field>
        <FieldLabel htmlFor="report-name">{copy.name}</FieldLabel>
        <Input
          id="report-name"
          size="lg"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </Field>
    </FormDialog>
  )
}
