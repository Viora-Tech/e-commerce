'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import PillTabs from '@/components/layout/pill-tabs'
import { loyaltyContent } from '@/data/loyalty'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type AdjustDialogProps = {
  customerId: string
  open: boolean
  /** The customer's points now, the most a removal can take. */
  points: number
  onClose: () => void
  onDone: () => void
}

type Mode = 'add' | 'remove'

/** Staff add or remove points with a reason the points history shows. */
export default function AdjustDialog({
  customerId,
  open,
  points,
  onClose,
  onDone,
}: AdjustDialogProps) {
  // Hooks
  const copy = useCopy(loyaltyContent)
  const [mode, setMode] = useState<Mode>('add')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  // Helpers
  const reset = () => {
    setMode('add')
    setAmount('')
    setReason('')
  }

  // Event handlers
  const handleClose = () => {
    reset()
    onClose()
  }
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    try {
      await api.loyalty.adjust({
        customerId,
        points: mode === 'remove' ? -n : n,
        reason: reason.trim(),
      })
      toast.success(d.saved)
      reset()
      onDone()
    } catch (err) {
      toast.error(errorText(err, d.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const d = copy.adjust
  const n = Math.floor(Number(amount))
  const tooMuch = mode === 'remove' && n > points
  const valid = Number.isFinite(n) && n > 0 && !tooMuch && reason.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? handleClose() : undefined)}>
      <DialogContent busy={busy}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{d.title}</DialogTitle>
            <DialogDescription>{d.body(copy.points(points))}</DialogDescription>
          </DialogHeader>
          <PillTabs
            variant="segmented"
            value={mode}
            onChange={(m: Mode) => setMode(m)}
            tabs={[
              { value: 'add', label: d.add },
              { value: 'remove', label: d.remove },
            ]}
          />
          <Field data-invalid={tooMuch || undefined}>
            <FieldLabel htmlFor="loyalty-points">{d.amount}</FieldLabel>
            <Input
              id="loyalty-points"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={amount}
              aria-invalid={tooMuch || undefined}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {tooMuch ? <FieldError>{d.tooMuch}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="loyalty-reason">{d.reason}</FieldLabel>
            <Input
              id="loyalty-reason"
              value={reason}
              maxLength={200}
              placeholder={d.reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
            />
            <FieldDescription>{d.reasonHint}</FieldDescription>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
              {d.cancel}
            </Button>
            <Button
              type="submit"
              variant={mode === 'remove' ? 'destructive' : 'default'}
              disabled={!valid}
              loading={busy}
            >
              {d.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
