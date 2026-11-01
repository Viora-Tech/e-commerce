'use client'

import type { PaymentAdjustment } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import PaymentAdjustmentFields from '@/components/settings/payment-adjustment-fields'
import { paymentRoutingContent } from '@/data/payment-routing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { PaymentsSetup } from './types'

type ManualMethodDialogProps = {
  kind: 'upi' | 'bank'
  manual: PaymentsSetup['manualMethods']
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => Promise<void>
}

type Details = PaymentsSetup['manualMethods']['details']
type DetailKey = keyof Details

const FIELDS: Record<'upi' | 'bank', readonly DetailKey[]> = {
  upi: ['upiId', 'payeeName'],
  bank: ['bankName', 'accountName', 'accountNumber', 'ifsc'],
}

/** Every field this row edits is filled, so it can be shown at checkout. */
const filled = (kind: 'upi' | 'bank', d: Details) => FIELDS[kind].every((k) => d[k].trim() !== '')

/**
 * Edit one "Manual payment methods" row (audit #149): the UPI ID or bank details the shopper
 * pays to, whether checkout shows it, the shopper's instructions and the shared fee or
 * discount. A dialog, never a side drawer.
 */
export default function ManualMethodDialog({
  kind,
  manual,
  open,
  onOpenChange,
  onSaved,
}: ManualMethodDialogProps) {
  // Hooks
  const { dialog: copy, manual: rowCopy } = useCopy(paymentRoutingContent)
  const [details, setDetails] = useState<Details>(manual.details)
  const [on, setOn] = useState(manual[kind].on || !manual[kind].ready)
  const [note, setNote] = useState(manual[kind].note)
  const [adjustment, setAdjustment] = useState<PaymentAdjustment | undefined>(
    manual.adjustment ?? undefined,
  )
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleField = (key: DetailKey, value: string) => setDetails((d) => ({ ...d, [key]: value }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.payments.saveManual({
        kind,
        on,
        note,
        fields: Object.fromEntries(FIELDS[kind].map((k) => [k, details[k]])),
        adjustment: adjustment ?? null,
      })
      toast.success(rowCopy.saved)
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : rowCopy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const labels: Record<DetailKey, { label: string; help?: string }> = {
    upiId: { label: copy.upiId, help: copy.upiIdHelp },
    payeeName: { label: copy.payeeName, help: copy.payeeNameHelp },
    bankName: { label: copy.bankName },
    accountName: { label: copy.accountName },
    accountNumber: { label: copy.accountNumber },
    ifsc: { label: copy.ifsc, help: copy.ifscHelp },
  }
  const canSave = !saving && (!on || filled(kind, details))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'upi' ? copy.upiTitle : copy.bankTitle}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <label className="flex items-center justify-between gap-3" htmlFor={`manual-${kind}-on`}>
            <span className="text-body font-semibold text-ink-strong">{copy.on}</span>
            <Switch
              id={`manual-${kind}-on`}
              checked={on}
              onCheckedChange={setOn}
              disabled={saving}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            {FIELDS[kind].map((key) => (
              <Field key={key}>
                <FieldLabel htmlFor={`manual-${key}`}>{labels[key].label}</FieldLabel>
                <Input
                  size="lg"
                  id={`manual-${key}`}
                  value={details[key]}
                  onChange={(e) => handleField(key, e.target.value)}
                  autoComplete="off"
                />
                {labels[key].help ? <FieldDescription>{labels[key].help}</FieldDescription> : null}
              </Field>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor={`manual-${kind}-note`}>{copy.note}</FieldLabel>
            <Textarea
              id={`manual-${kind}-note`}
              value={note}
              maxLength={500}
              placeholder={copy.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
            />
            <FieldDescription>{copy.noteHelp}</FieldDescription>
          </Field>
          <div className="flex flex-col gap-2">
            <PaymentAdjustmentFields
              providerId="manual"
              value={adjustment}
              onChange={setAdjustment}
            />
            <p className="text-caption text-muted-foreground">{copy.adjustmentNote}</p>
          </div>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? <Spinner /> : null}
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
