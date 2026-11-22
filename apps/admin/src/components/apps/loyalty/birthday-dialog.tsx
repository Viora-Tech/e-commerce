'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/fields/date-field'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { loyaltyContent } from '@/data/loyalty'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type BirthdayDialogProps = {
  customerId: string
  open: boolean
  /** Saved as `MM-DD`; null when none. */
  birthday: string | null
  onClose: () => void
  onDone: () => void
}

/** A leap year, so 29 February can be picked; only the month and day are saved. */
const PICKER_YEAR = '2000'

/** Staff set, change or remove a customer's birthday (month and day only). */
export default function BirthdayDialog({
  customerId,
  open,
  birthday,
  onClose,
  onDone,
}: BirthdayDialogProps) {
  // Hooks
  const copy = useCopy(loyaltyContent)
  const [value, setValue] = useState(birthday ? `${PICKER_YEAR}-${birthday}` : '')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.loyalty.setBirthday({ customerId, birthday: value || null })
      toast.success(d.saved)
      onDone()
    } catch (err) {
      toast.error(errorText(err, d.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const d = copy.birthday

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent busy={busy}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{d.title}</DialogTitle>
            <DialogDescription>{d.body}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="loyalty-birthday">{d.title}</FieldLabel>
            <DateField
              id="loyalty-birthday"
              value={value}
              onChange={setValue}
              min={`${PICKER_YEAR}-01-01`}
              max={`${PICKER_YEAR}-12-31`}
              clearable
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              {d.cancel}
            </Button>
            <Button type="submit" loading={busy}>
              {d.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
