'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import FormDialog from '@/components/layout/form-dialog'
import { accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'

type PasskeyNameDialogProps = {
  /** The dialog's title ("Add a passkey", "Rename"); null keeps it closed. */
  title: string | null
  /** The name the box starts with. */
  initialName: string
  submitLabel: string
  busy: boolean
  onCancel: () => void
  onSubmit: (name: string) => void
}

const NAME_MAX = 60

/** One text box for a passkey's name, used before adding one and to rename one. */
export default function PasskeyNameDialog({
  title,
  initialName,
  submitLabel,
  busy,
  onCancel,
  onSubmit,
}: PasskeyNameDialogProps) {
  // Hooks
  const {
    security: { passkeys: copy },
  } = useCopy(accountContent)
  const [name, setName] = useState(initialName)
  useEffect(() => {
    if (title !== null) setName(initialName)
  }, [title, initialName])

  // Event handlers
  const handleSubmit = () => {
    const trimmed = name.trim()
    if (trimmed) onSubmit(trimmed.slice(0, NAME_MAX))
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) onCancel()
  }

  return (
    <FormDialog
      open={title !== null}
      onOpenChange={handleOpenChange}
      title={title ?? ''}
      submitLabel={submitLabel}
      cancelLabel={copy.cancel}
      busy={busy}
      submitDisabled={!name.trim()}
      onSubmit={handleSubmit}
      size="md"
    >
      <Field>
        <FieldLabel htmlFor="passkey-name">{copy.nameLabel}</FieldLabel>
        <Input
          id="passkey-name"
          size="lg"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.namePlaceholder}
          autoComplete="off"
          disabled={busy}
          autoFocus
        />
      </Field>
    </FormDialog>
  )
}
