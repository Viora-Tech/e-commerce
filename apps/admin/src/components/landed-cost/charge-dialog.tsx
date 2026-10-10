'use client'

import {
  defaultRecoverable,
  defaultSplitMethod,
  type PurchaseChargeKind,
} from '@commerce/core/inventory'
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
import { Switch } from '@commerce/ui/shadcn/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import { chargesContent, PURCHASE_CHARGE_KINDS, SPLIT_METHODS } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type ChargeDraft, chargeFields, draftFrom, figuresOf } from './charge-draft'
import ChargeLinesField from './charge-lines-field'
import CurrencySelect from './currency-select'
import OptionSelect from './option-select'
import type { ChargeOwner, PreviewCharge, PreviewLine } from './types'

type ChargeDialogProps = {
  owner: ChargeOwner
  /** The charge being edited; null adds a new one. */
  charge: PreviewCharge | null
  /** Lines this charge can be split onto. */
  lines: PreviewLine[]
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

/** Add or edit one charge: what it is, how much (in any currency), GST, and how it splits. */
export default function ChargeDialog({
  owner,
  charge,
  lines,
  onOpenChange,
  onSaved,
}: ChargeDialogProps) {
  // Hooks
  const copy = useCopy(chargesContent)
  const [d, setD] = useState<ChargeDraft>(() => draftFrom(charge))
  const [busy, setBusy] = useState(false)

  // Helpers
  const patch = (next: Partial<ChargeDraft>) => setD((prev) => ({ ...prev, ...next }))

  // Event handlers
  const handleKind = (kind: PurchaseChargeKind) =>
    patch({ kind, splitMethod: defaultSplitMethod(kind), recoverable: defaultRecoverable(kind) })

  const handleSave = async () => {
    const built = chargeFields(d, lines)
    if ('error' in built) {
      toast.error(copy.dialog[built.error])
      return
    }
    setBusy(true)
    try {
      if (charge) await api.purchaseCharges.update({ id: charge.id, ...built.fields })
      else await api.purchaseCharges.add({ ...owner, ...built.fields })
      toast.success(charge ? copy.saved : copy.added)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const { totalPaise } = figuresOf(d)

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{charge ? copy.dialog.editTitle : copy.dialog.addTitle}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="charge-kind">{copy.dialog.kind}</FieldLabel>
            <OptionSelect
              id="charge-kind"
              options={PURCHASE_CHARGE_KINDS}
              labels={copy.kinds}
              value={d.kind}
              onChange={handleKind}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <Field>
              <FieldLabel htmlFor="charge-amount">{copy.dialog.amount}</FieldLabel>
              <Input
                id="charge-amount"
                value={d.amount}
                inputMode="decimal"
                className="tabular-nums"
                onChange={(e) => patch({ amount: e.target.value })}
              />
              {d.kind === 'goods_adjustment' ? (
                <FieldDescription>{copy.dialog.amountHint}</FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="charge-currency">{copy.dialog.currency}</FieldLabel>
              <CurrencySelect
                id="charge-currency"
                value={d.currency}
                className="w-full"
                onChange={(currency) => patch({ currency, fxRate: currency === 'INR' ? '1' : '' })}
              />
            </Field>
          </div>
          {d.currency === 'INR' ? null : (
            <Field>
              <FieldLabel htmlFor="charge-fx">{copy.dialog.fxRate}</FieldLabel>
              <Input
                id="charge-fx"
                value={d.fxRate}
                inputMode="decimal"
                placeholder="83.25"
                className="tabular-nums"
                onChange={(e) => patch({ fxRate: e.target.value })}
              />
              <FieldDescription>{copy.dialog.fxHint(d.currency)}</FieldDescription>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="charge-gst">{copy.dialog.gst}</FieldLabel>
            <Input
              id="charge-gst"
              value={d.gst}
              inputMode="decimal"
              placeholder="0"
              className="tabular-nums"
              onChange={(e) => patch({ gst: e.target.value })}
            />
            <FieldDescription>{copy.dialog.gstHint}</FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <Switch
              id="charge-recoverable"
              checked={d.recoverable}
              onCheckedChange={(recoverable) => patch({ recoverable })}
            />
            <span className="flex flex-col">
              <FieldLabel htmlFor="charge-recoverable">{copy.dialog.recoverable}</FieldLabel>
              <FieldDescription>{copy.dialog.recoverableHint}</FieldDescription>
            </span>
          </Field>
          <Field>
            <FieldLabel htmlFor="charge-split">{copy.dialog.split}</FieldLabel>
            <OptionSelect
              id="charge-split"
              options={SPLIT_METHODS}
              labels={copy.methods}
              value={d.splitMethod}
              onChange={(splitMethod) => patch({ splitMethod })}
            />
          </Field>
          {d.splitMethod === 'specific_lines' || d.splitMethod === 'manual' ? (
            <ChargeLinesField
              method={d.splitMethod}
              lines={lines}
              selected={d.splitLineIds}
              manual={d.manual}
              totalPaise={totalPaise}
              onSelect={(splitLineIds) => patch({ splitLineIds })}
              onManual={(manual) => patch({ manual })}
            />
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="charge-payee">{copy.dialog.payee}</FieldLabel>
              <Input
                id="charge-payee"
                value={d.payee}
                placeholder={copy.dialog.payeePlaceholder}
                onChange={(e) => patch({ payee: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="charge-date">{copy.dialog.incurredAt}</FieldLabel>
              <Input
                id="charge-date"
                type="date"
                value={d.incurredAt}
                onChange={(e) => patch({ incurredAt: e.target.value })}
              />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="charge-note">{copy.dialog.note}</FieldLabel>
            <Input
              id="charge-note"
              value={d.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.dialog.cancel}
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? copy.dialog.saving : copy.dialog.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
