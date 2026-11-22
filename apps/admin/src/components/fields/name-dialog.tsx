'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type ReactNode, useEffect, useId, useState } from 'react'
import FormDialog from '@/components/layout/form-dialog'

type NameDialogProps = {
  /** Shown while true; defaults to open (mount it when needed). */
  open?: boolean | undefined
  title: string
  description?: string | undefined
  /** The box's label ("Name"). */
  label: string
  /** The name the box starts with; the box resets to it each time the dialog opens. */
  initialName: string
  submitLabel: string
  cancelLabel: string
  busy?: boolean | undefined
  maxLength?: number | undefined
  placeholder?: string | undefined
  /** A line under the box. */
  help?: ReactNode
  /** How the typed text becomes the name (trimmed by default; a template suffix also lowercases). */
  normalise?: ((typed: string) => string) | undefined
  /** Whether that name can be saved; any non-empty name by default. */
  isValid?: ((name: string) => boolean) | undefined
  onCancel: () => void
  /** Gets the normalised name; a promise keeps the dialog busy until it settles. */
  onSubmit: (name: string) => unknown
  stopPropagation?: boolean | undefined
}

const trim = (typed: string) => typed.trim()

/**
 * The one "name it" dialog (owner, 22 Nov 2026): a single text box for renaming a menu, theme or
 * template, naming a saved report or a passkey.
 */
export default function NameDialog({
  open = true,
  title,
  description,
  label,
  initialName,
  submitLabel,
  cancelLabel,
  busy,
  maxLength,
  placeholder,
  help,
  normalise = trim,
  isValid,
  onCancel,
  onSubmit,
  stopPropagation,
}: NameDialogProps) {
  // Hooks
  const id = useId()
  const [typed, setTyped] = useState(initialName)
  useEffect(() => {
    if (open) setTyped(initialName)
  }, [open, initialName])

  // Derived values
  const name = normalise(typed)
  const valid = name.length > 0 && (isValid ? isValid(name) : true)

  // Event handlers
  const handleSubmit = async () => {
    if (valid) await onSubmit(name)
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title={title}
      description={description}
      submitLabel={submitLabel}
      cancelLabel={cancelLabel}
      busy={busy}
      submitDisabled={!valid || busy}
      onSubmit={handleSubmit}
      stopPropagation={stopPropagation}
    >
      <Field>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Input
          id={id}
          size="lg"
          value={typed}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoFocus
        />
        {help ? <FieldDescription>{help}</FieldDescription> : null}
      </Field>
    </FormDialog>
  )
}
