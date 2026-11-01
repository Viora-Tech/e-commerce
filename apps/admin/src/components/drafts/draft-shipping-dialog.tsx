'use client'

import { parseRupees } from '@commerce/money'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { useEffect, useId, useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import FormDialog from '@/components/layout/form-dialog'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'

type DraftShippingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  shippingPaise: number
  onApply: (shippingPaise: number) => void
}

const paiseToText = (paise: number) => (paise > 0 ? (paise / 100).toFixed(2) : '')

/** "Add shipping" on a draft (audit #29): the delivery charge the customer pays. */
export default function DraftShippingDialog({
  open,
  onOpenChange,
  shippingPaise,
  onApply,
}: DraftShippingDialogProps) {
  // Hooks
  const { totals: copy } = useCopy(draftEditorContent)
  const amountId = useId()
  const [amount, setAmount] = useState('')

  // biome-ignore lint/correctness/useExhaustiveDependencies: the field starts from the draft each time the dialog opens.
  useEffect(() => {
    if (open) setAmount(paiseToText(shippingPaise))
  }, [open])

  // Event handlers
  const handleSubmit = () => {
    onApply(parseRupees(amount) ?? 0)
    onOpenChange(false)
  }

  // Render logic
  const valid = amount.trim() === '' || parseRupees(amount) !== null

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.shippingDialog.title}
      submitLabel={copy.shippingDialog.apply}
      cancelLabel={copy.shippingDialog.cancel}
      submitDisabled={!valid}
      onSubmit={handleSubmit}
      size="md"
    >
      <Field>
        <FieldLabel htmlFor={amountId}>{copy.shippingDialog.amount}</FieldLabel>
        <MoneyInput id={amountId} value={amount} onChange={setAmount} />
        <FieldDescription>{copy.shippingDialog.help}</FieldDescription>
      </Field>
    </FormDialog>
  )
}
