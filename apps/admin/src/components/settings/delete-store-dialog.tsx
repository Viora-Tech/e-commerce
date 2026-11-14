'use client'

import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { storeDataContent } from '@/data/store-data'
import { useCopy } from '@/hooks/use-copy'

type DeleteStoreDialogProps = {
  open: boolean
  storeName: string
  busy: boolean
  onOpenChange: (open: boolean) => void
  /** Called with what the owner typed; the server checks it again. */
  onConfirm: (typed: string) => void
}

/** Same rule as the server: the store name, ignoring case and outer spaces. */
const matches = (typed: string, name: string) =>
  typed.trim().toLowerCase() === name.trim().toLowerCase() && name.trim().length > 0

/**
 * The last step before closing a store: says plainly what goes, and only enables the
 * button once the owner has typed the store's name. A ConfirmDialog with a typed check
 * (audit 9b): the same shell, X and footer as every other confirm.
 */
export default function DeleteStoreDialog({
  open,
  storeName,
  busy,
  onOpenChange,
  onConfirm,
}: DeleteStoreDialogProps) {
  // Hooks
  const content = useCopy(storeDataContent)
  const [typed, setTyped] = useState('')

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped('')
    onOpenChange(next)
  }

  const handleConfirm = () => {
    if (matches(typed, storeName)) onConfirm(typed)
  }

  // Render logic
  const copy = content.dialog
  const ok = matches(typed, storeName)
  const showMismatch = typed.trim().length >= storeName.trim().length && !ok

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.title}
      body={copy.body}
      confirmLabel={copy.confirm}
      cancelLabel={copy.cancel}
      tone="destructive"
      busy={busy}
      confirmDisabled={!ok}
      onConfirm={handleConfirm}
    >
      <Field>
        <FieldLabel htmlFor="delete-store-confirm">{copy.typeToConfirm(storeName)}</FieldLabel>
        <Input
          id="delete-store-confirm"
          size="lg"
          autoComplete="off"
          placeholder={copy.placeholder}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          aria-invalid={showMismatch || undefined}
        />
        {showMismatch ? <FieldError>{copy.mismatch}</FieldError> : null}
      </Field>
    </ConfirmDialog>
  )
}
