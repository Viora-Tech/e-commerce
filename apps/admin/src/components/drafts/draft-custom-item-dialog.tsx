'use client'

import { parseRupees } from '@commerce/money'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useId, useState } from 'react'
import {
  type CustomItemError,
  type CustomItemFields,
  customItemErrors,
  customItemLine,
  type DraftLine,
} from '@/components/drafts/draft-form-state'
import MoneyInput from '@/components/fields/money-input'
import FormDialog from '@/components/layout/form-dialog'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'

type DraftCustomItemDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (line: DraftLine) => void
}

const EMPTY: CustomItemFields = { title: '', price: '', quantity: '1', taxable: true, hsCode: '' }

/**
 * "Add custom item" (audit #28): a one-off line that is not in the catalogue, such as an
 * alteration or a hand-priced bundle. Title, price and quantity; GST at the store rate unless
 * switched off, and an optional HSN for the invoice.
 */
export default function DraftCustomItemDialog({
  open,
  onOpenChange,
  onAdd,
}: DraftCustomItemDialogProps) {
  // Hooks
  const { customItem: copy } = useCopy(draftEditorContent)
  const ids = { title: useId(), price: useId(), quantity: useId(), taxable: useId(), hs: useId() }
  const [fields, setFields] = useState<CustomItemFields>(EMPTY)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setFields(EMPTY)
    setTouched(false)
  }, [open])

  // Helpers
  const patch = (next: Partial<CustomItemFields>) => setFields((f) => ({ ...f, ...next }))
  const errorFor = (key: CustomItemError) =>
    touched && customItemErrors(fields, parseRupees).includes(key) ? (
      <FieldError>{copy.errors[key]}</FieldError>
    ) : null

  // Event handlers
  const handleSubmit = () => {
    setTouched(true)
    const pricePaise = parseRupees(fields.price)
    if (customItemErrors(fields, parseRupees).length > 0 || pricePaise === null) return
    onAdd(customItemLine(fields, pricePaise, `custom:${crypto.randomUUID()}`))
    onOpenChange(false)
  }

  // Render logic
  const errors = touched ? customItemErrors(fields, parseRupees) : []

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      submitLabel={copy.add}
      cancelLabel={copy.cancel}
      onSubmit={handleSubmit}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <Field data-invalid={errors.includes('title') || undefined}>
          <FieldLabel htmlFor={ids.title}>{copy.name}</FieldLabel>
          <Input
            id={ids.title}
            value={fields.title}
            maxLength={200}
            onChange={(e) => patch({ title: e.target.value })}
            autoFocus
          />
          {errorFor('title')}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={errors.includes('price') || undefined}>
            <FieldLabel htmlFor={ids.price}>{copy.price}</FieldLabel>
            <MoneyInput
              id={ids.price}
              value={fields.price}
              onChange={(price) => patch({ price })}
              invalid={errors.includes('price')}
            />
            {errorFor('price')}
          </Field>
          <Field data-invalid={errors.includes('quantity') || undefined}>
            <FieldLabel htmlFor={ids.quantity}>{copy.quantity}</FieldLabel>
            <Input
              id={ids.quantity}
              type="number"
              min={1}
              max={999}
              value={fields.quantity}
              onChange={(e) => patch({ quantity: e.target.value })}
              className="tabular-nums"
            />
            {errorFor('quantity')}
          </Field>
        </div>
        <Field orientation="horizontal">
          <Switch
            id={ids.taxable}
            checked={fields.taxable}
            onCheckedChange={(taxable) => patch({ taxable })}
          />
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor={ids.taxable}>{copy.taxable}</FieldLabel>
            <FieldDescription>{copy.taxableHelp}</FieldDescription>
          </div>
        </Field>
        <Field data-invalid={errors.includes('hsCode') || undefined}>
          <FieldLabel htmlFor={ids.hs}>{copy.hsCode}</FieldLabel>
          <Input
            id={ids.hs}
            inputMode="numeric"
            maxLength={8}
            value={fields.hsCode}
            onChange={(e) => patch({ hsCode: e.target.value })}
          />
          {errorFor('hsCode')}
        </Field>
      </div>
    </FormDialog>
  )
}
