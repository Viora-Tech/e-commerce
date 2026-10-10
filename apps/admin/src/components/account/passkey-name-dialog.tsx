'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useEffect, useState } from 'react'
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
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onSubmit(trimmed.slice(0, NAME_MAX))
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && !busy) onCancel()
  }

  return (
    <Dialog open={title !== null} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
              {copy.cancel}
            </Button>
            <Button type="submit" loading={busy} disabled={!name.trim()}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
