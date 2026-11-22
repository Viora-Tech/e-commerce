'use client'

import { Send } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { useState } from 'react'
import DateField from '@/components/fields/date-field'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import { useCopy } from '@/hooks/use-copy'

type SendDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reach: number | null
  busy: boolean
  error: string | null
  onConfirm: (at: Date | null) => void
}

/** `datetime-local` wants local wall time without seconds. */
function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Send now or pick a time; the worker starts sending within a minute of it. */
export default function SendDialog({
  open,
  onOpenChange,
  reach,
  busy,
  error,
  onConfirm,
}: SendDialogProps) {
  // Hooks
  const copy = useCopy(campaignEditorContent.schedule)
  const [mode, setMode] = useState<'now' | 'later'>('now')
  const [at, setAt] = useState(() => localInput(new Date(Date.now() + 3_600_000)))

  // Event handlers
  const handleConfirm = () => onConfirm(mode === 'now' ? null : new Date(at))

  // Render logic
  const invalid = mode === 'later' && !(new Date(at).getTime() > Date.now())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent busy={busy}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'now' | 'later')}>
          <Field orientation="horizontal" className="gap-2">
            <RadioGroupItem id="send-now" value="now" />
            <FieldLabel htmlFor="send-now" className="text-body leading-5 font-normal">
              {copy.now}
            </FieldLabel>
          </Field>
          <Field orientation="horizontal" className="gap-2">
            <RadioGroupItem id="send-later" value="later" />
            <FieldLabel htmlFor="send-later" className="text-body leading-5 font-normal">
              {copy.later}
            </FieldLabel>
          </Field>
        </RadioGroup>
        {mode === 'later' ? (
          <Field>
            <FieldLabel htmlFor="send-at">{copy.at}</FieldLabel>
            <DateField mode="datetime" id="send-at" value={at} onChange={(v) => setAt(v)} />
            <FieldDescription>{copy.atHelp}</FieldDescription>
          </Field>
        ) : null}
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button loading={busy} onClick={handleConfirm} disabled={busy || invalid}>
            <Send aria-hidden="true" />
            {mode === 'now' ? copy.confirmNow(reach ?? 0) : copy.confirmLater}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
