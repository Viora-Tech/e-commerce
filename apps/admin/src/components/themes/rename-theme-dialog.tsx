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
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
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
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={!valid || busy} onClick={() => onRename(theme.id, name)}>
            {busy ? <Spinner /> : null}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
