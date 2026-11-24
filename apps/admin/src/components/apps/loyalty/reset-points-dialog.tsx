'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type ResetPointsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReset: () => void
}

/** The word the API wants, typed exactly. */
const WORD = 'RESET'

/** Takes every member to 0 points, only once RESET is typed (the server checks it again). */
export default function ResetPointsDialog({ open, onOpenChange, onReset }: ResetPointsDialogProps) {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (!next) setTyped('')
    onOpenChange(next)
  }

  const handleConfirm = async () => {
    if (typed.trim() !== WORD) return
    setBusy(true)
    try {
      const done = await api.loyalty.members.resetAll({ confirm: WORD })
      toast.success(copy.resetDialog.done(f.number(done.members), f.number(done.points)))
      onReset()
      handleOpenChange(false)
    } catch (err) {
      toast.error(errorText(err, copy.resetDialog.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const d = copy.resetDialog

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={d.title}
      body={d.body}
      confirmLabel={d.confirm}
      cancelLabel={d.cancel}
      tone="destructive"
      busy={busy}
      confirmDisabled={typed.trim() !== WORD}
      onConfirm={handleConfirm}
    >
      <Field>
        <FieldLabel htmlFor="loyalty-reset-confirm">{d.typeToConfirm}</FieldLabel>
        <Input
          id="loyalty-reset-confirm"
          autoComplete="off"
          placeholder={d.placeholder}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
        />
      </Field>
    </ConfirmDialog>
  )
}
