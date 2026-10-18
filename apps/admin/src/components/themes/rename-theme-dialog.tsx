'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import FormDialog from '@/components/layout/form-dialog'
import { themesContent } from '@/data/themes'

type RenameThemeDialogProps = {
  /** The theme being renamed. Mount the dialog per theme (`key`) so the field starts from its name. */
  theme: { id: string; name: string }
  busy: boolean
  onCancel: () => void
  onRename: (id: string, name: string) => void
}

const copy = themesContent.renameDialog

export default function RenameThemeDialog({
  theme,
  busy,
  onCancel,
  onRename,
}: RenameThemeDialogProps) {
  // Hooks
  const [name, setName] = useState(theme.name)

  // Render logic
  const trimmed = name.trim()
  const valid = trimmed.length > 0 && trimmed.length <= 50 && trimmed !== theme.name

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onCancel()}
      title={copy.title}
      submitLabel={copy.confirm}
      cancelLabel={copy.cancel}
      busy={busy}
      submitDisabled={!valid}
      onSubmit={() => onRename(theme.id, name)}
    >
      <Field>
        <FieldLabel htmlFor="rename-theme">{copy.name}</FieldLabel>
        <Input
          id="rename-theme"
          size="lg"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          autoFocus
        />
      </Field>
    </FormDialog>
  )
}
