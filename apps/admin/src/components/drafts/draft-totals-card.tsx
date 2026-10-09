'use client'

import { Card } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import { draftTotals } from '@/components/drafts/draft-form-state'
import DraftMoneyInput from '@/components/drafts/draft-money-input'
import { draftEditorContent as copy } from '@/data/drafts'
import { formatPaise } from '@/lib/money'

type DraftTotalsCardProps = {
  form: DraftFormState
  onChange: (patch: Partial<DraftFormState>) => void
}

export default function DraftTotalsCard({ form, onChange }: DraftTotalsCardProps) {
  // Render logic
  const { subtotalPaise, discountPaise, totalPaise } = draftTotals(form)

  return (
    <Card gap={4} inset={5}>
      <p className="text-kit-card-title text-foreground">{copy.totals.heading}</p>
      <dl className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-body">
          <dt className="text-muted-foreground">{copy.totals.subtotal}</dt>
          <dd className="tabular-nums">{formatPaise(subtotalPaise)}</dd>
        </div>
        {discountPaise > 0 ? (
          <div className="flex items-center justify-between text-body">
            <dt className="text-muted-foreground">{form.discountLabel || copy.totals.discount}</dt>
            <dd className="tabular-nums text-success">-{formatPaise(discountPaise)}</dd>
          </div>
        ) : null}
        {form.shippingPaise > 0 ? (
          <div className="flex items-center justify-between text-body">
            <dt className="text-muted-foreground">{copy.totals.shipping}</dt>
            <dd className="tabular-nums">{formatPaise(form.shippingPaise)}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-border border-t pt-2 text-body-strong">
          <dt>{copy.totals.total}</dt>
          <dd className="tabular-nums">{formatPaise(totalPaise)}</dd>
        </div>
      </dl>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="draft-discount">{copy.totals.discount}</FieldLabel>
          <DraftMoneyInput
            id="draft-discount"
            valuePaise={form.discountPaise}
            onChangePaise={(discountPaise) => onChange({ discountPaise })}
            className="text-right tabular-nums"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="draft-shipping">{copy.totals.shipping}</FieldLabel>
          <DraftMoneyInput
            id="draft-shipping"
            valuePaise={form.shippingPaise}
            onChangePaise={(shippingPaise) => onChange({ shippingPaise })}
            className="text-right tabular-nums"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="draft-discount-label">{copy.totals.discountLabel}</FieldLabel>
        <Input
          id="draft-discount-label"
          value={form.discountLabel}
          onChange={(e) => onChange({ discountLabel: e.target.value })}
        />
      </Field>
    </Card>
  )
}
