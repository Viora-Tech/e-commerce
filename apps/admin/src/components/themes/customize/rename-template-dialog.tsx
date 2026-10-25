'use client'

import { TEMPLATE_SUFFIX } from '@commerce/core/theme'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import FormDialog from '@/components/layout/form-dialog'
import { customizeContent } from '@/data/customize'

type RenameTemplateDialogProps = {
  /** The alternate's current suffix. Mount per template (`key`) so the field starts from it. */
  suffix: string
  /** "3 products", or empty when nothing uses it. */
  used: string
  busy: boolean
  onCancel: () => void
  onRename: (to: string) => void
}

const copy = customizeContent.templates.renameDialog

/** Rename an alternate template; resources assigned to it move to the new name. */
export default function RenameTemplateDialog({
  suffix,
  used,
  busy,
  onCancel,
  onRename,
}: RenameTemplateDialogProps) {
  // Hooks
  const [name, setName] = useState(suffix)

  // Render logic
  const next = name.trim().toLowerCase()
  const valid = next.length > 0 && TEMPLATE_SUFFIX.test(next) && next !== suffix

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={copy.title}
      submitLabel={copy.confirm}
      cancelLabel={copy.cancel}
      busy={busy}
      submitDisabled={!valid}
      onSubmit={() => onRename(next)}
    >
      <Field>
        <FieldLabel htmlFor="rename-template">{copy.name}</FieldLabel>
        <Input
          id="rename-template"
          size="lg"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          autoFocus
        />
        <FieldDescription>
          {copy.help}
          {used ? ` ${copy.moves(used)}` : ''}
        </FieldDescription>
      </Field>
    </FormDialog>
  )
}
