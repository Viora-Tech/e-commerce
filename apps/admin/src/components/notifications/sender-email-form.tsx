'use client'

import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { type FormEvent, useState } from 'react'
import { senderEmailContent as setupCopy } from '@/data/sender-email'

type SenderEmailFormProps = {
  initialEmail: string
  initialName: string
  storeName: string
  saving: boolean
  /** Plain-words refusal from the last save, shown under the address. */
  error: string | null
  /** Shown when changing an address that is already saved. */
  changing: boolean
  onSave: (input: { email: string; displayName: string }) => void
  onCancel?: (() => void) | undefined
}

const copy = setupCopy.form

/** The address and sender name, one Save. Checking the address is left to the server. */
export default function SenderEmailForm({
  initialEmail,
  initialName,
  storeName,
  saving,
  error,
  changing,
  onSave,
  onCancel,
}: SenderEmailFormProps) {
  // Hooks
  const [email, setEmail] = useState(initialEmail)
  const [name, setName] = useState(initialName)

  // Event handlers
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSave({ email: email.trim(), displayName: name.trim() })
  }

  // Render logic
  const canSave = !saving && email.trim().length > 0

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="sender-email">{copy.emailLabel}</FieldLabel>
          <Input
            size="lg"
            id="sender-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={copy.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
          />
          {error ? (
            <FieldError>{error}</FieldError>
          ) : (
            <FieldDescription>{copy.emailHelp}</FieldDescription>
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="sender-name">{copy.nameLabel}</FieldLabel>
          <Input
            size="lg"
            id="sender-name"
            autoComplete="off"
            placeholder={storeName}
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <FieldDescription>{copy.nameHelp(storeName)}</FieldDescription>
        </Field>
      </div>
      {changing ? <p className="text-caption text-muted-foreground">{copy.changeWarning}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={!canSave} className="w-full sm:w-auto">
          {saving ? <Spinner /> : <Save aria-hidden="true" />}
          {saving ? copy.saving : copy.save}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onCancel}>
            {copy.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
