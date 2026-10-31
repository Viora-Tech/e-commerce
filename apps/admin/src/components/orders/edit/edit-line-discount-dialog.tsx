'use client'

import { parseRupees } from '@commerce/money'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useId, useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import FormDialog from '@/components/layout/form-dialog'
import PillTabs from '@/components/layout/pill-tabs'
import { orderEditContent } from '@/data/order-edit'
import { useCopy, useFormat } from '@/hooks/use-copy'

/** The line a discount is being given on. */
export type DiscountTarget = {
  name: string
  /** The line's price before this discount, in minor units. */
  unitPricePaise: number
}

type Mode = 'amount' | 'percent'

type EditLineDiscountDialogProps = {
  /** The line; null keeps the dialog closed. */
  target: DiscountTarget | null
  onClose: () => void
  /** The discounted unit price, in minor units. */
  onApply: (unitPricePaise: number) => void
}

/** The discounted unit price, or null while what is typed is not a discount below the price. */
function discounted(mode: Mode, typed: string, price: number): number | null {
  if (mode === 'percent') {
    const pct = Number(typed)
    if (!typed.trim() || !Number.isFinite(pct) || pct <= 0 || pct > 100) return null
    return price - Math.round((price * pct) / 100)
  }
  const off = parseRupees(typed)
  if (off === null || off <= 0 || off > price) return null
  return price - off
}

/** "Add discount" on one line of an order edit (#1014): an amount or a percent off each unit. */
export default function EditLineDiscountDialog({
  target,
  onClose,
  onApply,
}: EditLineDiscountDialogProps) {
  // Hooks
  const { lineDiscount: copy } = useCopy(orderEditContent)
  const fmt = useFormat()
  const fieldId = useId()
  const [mode, setMode] = useState<Mode>('amount')
  const [typed, setTyped] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!target) return
    setMode('amount')
    setTyped('')
    setTouched(false)
  }, [target])

  // Event handlers
  const handleSubmit = () => {
    setTouched(true)
    const price = discounted(mode, typed, target?.unitPricePaise ?? 0)
    if (price === null) return
    onApply(price)
    onClose()
  }

  // Render logic
  const next = discounted(mode, typed, target?.unitPricePaise ?? 0)

  return (
    <FormDialog
      open={target !== null}
      onOpenChange={(open) => (!open ? onClose() : undefined)}
      title={copy.title(target?.name ?? '')}
      submitLabel={copy.apply}
      cancelLabel={copy.cancel}
      onSubmit={handleSubmit}
      size="md"
    >
      <PillTabs<Mode>
        variant="segmented"
        value={mode}
        onChange={(m) => {
          setMode(m)
          setTyped('')
        }}
        tabs={[
          { value: 'amount', label: copy.amount },
          { value: 'percent', label: copy.percent },
        ]}
      />
      <Field data-invalid={(touched && next === null) || undefined}>
        <FieldLabel htmlFor={fieldId}>
          {mode === 'amount' ? copy.amountLabel : copy.percentLabel}
        </FieldLabel>
        {mode === 'amount' ? (
          <MoneyInput id={fieldId} value={typed} onChange={setTyped} />
        ) : (
          <Input
            id={fieldId}
            type="number"
            min={1}
            max={100}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="tabular-nums"
          />
        )}
        {touched && next === null ? (
          <FieldError>{copy.invalid}</FieldError>
        ) : next !== null ? (
          <FieldDescription>{copy.newPrice(fmt.money(next))}</FieldDescription>
        ) : null}
      </Field>
    </FormDialog>
  )
}
