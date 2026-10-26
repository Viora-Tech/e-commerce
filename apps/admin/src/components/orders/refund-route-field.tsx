'use client'

import type { RefundOptions, RefundRoute } from '@commerce/core'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { orderDetailContent } from '@/data/order-detail'
import { refundRouteContent } from '@/data/order-edit'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { methodLabel } from './order-detail-types'

type RefundRouteFieldProps = {
  /** What the order can refund and how; null while it loads. */
  options: RefundOptions | null
  /** How much would go back. */
  amountPaise: number
  value: RefundRoute
  onChange: (route: RefundRoute) => void
  /** Prefix for the radio ids, so two of these never share one. */
  idPrefix: string
}

/**
 * The refund choice shared by "Cancel order" and the edit review: to the original payment
 * (only when every payment can go back that way), recorded by hand, or none.
 */
export default function RefundRouteField({
  options,
  amountPaise,
  value,
  onChange,
  idPrefix,
}: RefundRouteFieldProps) {
  // Hooks
  const copy = useCopy(refundRouteContent)
  const detail = useCopy(orderDetailContent)
  const fmt = useFormat()

  // Render logic
  const via = (options?.providers ?? []).map((p) => methodLabel(p, detail)).join(', ')
  const routes: { id: RefundRoute; label: string; hint: string }[] = [
    ...(options?.original
      ? [{ id: 'original' as const, label: copy.original(via), hint: copy.originalHint }]
      : []),
    { id: 'manual', label: copy.manual, hint: copy.manualHint },
    { id: 'none', label: copy.none, hint: copy.noneHint },
  ]

  return (
    <Field>
      <FieldLabel>
        {copy.heading} · {copy.amount(fmt.money(amountPaise))}
      </FieldLabel>
      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as RefundRoute)}
        className="flex flex-col gap-2"
      >
        {routes.map((r) => (
          <label
            key={r.id}
            htmlFor={`${idPrefix}-${r.id}`}
            className="flex items-start gap-3 rounded-md border border-border px-3 py-2.5 text-body has-data-checked:border-primary"
          >
            <RadioGroupItem id={`${idPrefix}-${r.id}`} value={r.id} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-ink-strong">{r.label}</span>
              <span className="text-caption text-muted-foreground">{r.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      {options && !options.original ? (
        <FieldDescription>{copy.unavailable}</FieldDescription>
      ) : null}
    </Field>
  )
}
