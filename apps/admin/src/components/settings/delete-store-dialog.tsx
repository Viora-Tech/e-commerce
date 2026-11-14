'use client'

import { Trash2 } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
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
 * button once the owner has typed the store's name.
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
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-h-[min(85svh,48rem)] overflow-y-auto overscroll-contain data-[size=default]:max-w-[calc(100%-2rem)] data-[size=default]:sm:max-w-[38rem]">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
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
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{copy.cancel}</AlertDialogCancel>
          <Button
            loading={busy}
            variant="destructive"
            onClick={handleConfirm}
            disabled={!ok || busy}
          >
            <Trash2 aria-hidden="true" />
            {busy ? copy.deleting : copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
