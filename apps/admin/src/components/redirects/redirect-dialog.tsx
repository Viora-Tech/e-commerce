'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import { type RedirectListItem, redirectsContent } from '@/data/redirects'
import { api } from '@/lib/api-client'

type RedirectDialogProps = {
  /** Null creates a new redirect. */
  redirect: RedirectListItem | null
  onClose: () => void
  onSaved: () => void
}

const copy = redirectsContent.dialog

export default function RedirectDialog({ redirect, onClose, onSaved }: RedirectDialogProps) {
  // Hooks
  const [path, setPath] = useState(redirect?.path ?? '')
  const [target, setTarget] = useState(redirect?.target ?? '')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      await api.redirects.save({ id: redirect?.id, path, target })
      toast.success(copy.saved)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const canSave = path.trim().length > 0 && target.trim().length > 0 && !busy

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{redirect ? copy.editTitle : copy.createTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="redirect-path">{copy.path}</FieldLabel>
            <Input
              id="redirect-path"
              size="lg"
              value={path}
              placeholder={copy.pathPlaceholder}
              onChange={(e) => setPath(e.target.value)}
              autoComplete="off"
              autoFocus
            />
            <FieldDescription>{copy.pathHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="redirect-target">{copy.target}</FieldLabel>
            <Input
              id="redirect-target"
              size="lg"
              value={target}
              placeholder={copy.targetPlaceholder}
              onChange={(e) => setTarget(e.target.value)}
              autoComplete="off"
            />
            <FieldDescription>{copy.targetHelp}</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {busy ? <Spinner /> : null}
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
