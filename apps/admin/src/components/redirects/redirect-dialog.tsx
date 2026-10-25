'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { type RedirectListItem, redirectsContent } from '@/data/redirects'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RedirectDialogProps = {
  /** Null creates a new redirect. */
  redirect: RedirectListItem | null
  onClose: () => void
  onSaved: () => void
}

export default function RedirectDialog({ redirect, onClose, onSaved }: RedirectDialogProps) {
  // Hooks
  const { dialog: copy } = useCopy(redirectsContent)
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
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={redirect ? copy.editTitle : copy.createTitle}
      submitLabel={copy.save}
      cancelLabel={copy.cancel}
      busy={busy}
      submitDisabled={!canSave}
      onSubmit={handleSave}
    >
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
    </FormDialog>
  )
}
