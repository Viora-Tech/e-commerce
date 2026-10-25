'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import ChoiceTile from '@/components/fields/choice-tile'
import RequiredMark from '@/components/fields/required-mark'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import { useCopy } from '@/hooks/use-copy'
import type { DiscountFormState, DiscountType } from './form-state'
import { randomCode } from './form-state'

type MethodCardProps = {
  form: Pick<DiscountFormState, 'type' | 'title' | 'kind' | 'code' | 'method'>
  /** The type is picked once, when the discount is created. */
  typeLocked: boolean
  titleError?: string | undefined
  codeError?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

const KINDS = ['code', 'automatic'] as const
const TYPES = ['products', 'order', 'bxgy', 'shipping'] as const

export default function MethodCard({
  form,
  typeLocked,
  titleError,
  codeError,
  onChange,
}: MethodCardProps) {
  // Hooks
  const { method: copy, type: typeCopy } = useCopy(discountFormContent)

  // Event handlers
  const handleGenerate = () => onChange({ code: randomCode() })

  const handleType = (type: DiscountType) =>
    onChange({
      type,
      method:
        type === 'shipping'
          ? 'free_shipping'
          : form.method === 'free_shipping'
            ? 'percent'
            : form.method,
    })

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <Field>
          <FieldLabel>{typeCopy.heading}</FieldLabel>
          <RadioGroup
            value={form.type}
            onValueChange={(v) => handleType(v as DiscountType)}
            disabled={typeLocked}
            className="grid gap-3 md:grid-cols-2"
          >
            {TYPES.map((t) => (
              <ChoiceTile
                key={t}
                name="type"
                value={t}
                checked={form.type === t}
                label={typeCopy.options[t].label}
                help={typeCopy.options[t].help}
              />
            ))}
          </RadioGroup>
          {typeLocked ? <FieldDescription>{typeCopy.locked}</FieldDescription> : null}
        </Field>
        <Field>
          <FieldLabel>{copy.kindLabel}</FieldLabel>
          <RadioGroup
            value={form.kind}
            onValueChange={(v) => onChange({ kind: v as DiscountFormState['kind'] })}
            className="grid gap-3 md:grid-cols-2"
          >
            {KINDS.map((k) => (
              <ChoiceTile
                key={k}
                name="kind"
                value={k}
                checked={form.kind === k}
                label={copy.kinds[k].label}
                help={copy.kinds[k].help}
              />
            ))}
          </RadioGroup>
        </Field>
        <Field data-invalid={titleError ? true : undefined}>
          <FieldLabel htmlFor="discount-title">
            {copy.title}
            <RequiredMark />
          </FieldLabel>
          <Input
            size="lg"
            id="discount-title"
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-invalid={titleError ? true : undefined}
            maxLength={120}
          />
          {titleError ? (
            <FieldError>{titleError}</FieldError>
          ) : (
            <FieldDescription>{copy.titleHelp}</FieldDescription>
          )}
        </Field>
        {form.kind === 'code' ? (
          <Field data-invalid={codeError ? true : undefined}>
            <FieldLabel htmlFor="discount-code">
              {copy.code}
              <RequiredMark />
            </FieldLabel>
            <div className="flex gap-2">
              <Input
                size="lg"
                id="discount-code"
                className="font-mono uppercase"
                value={form.code}
                onChange={(e) => onChange({ code: e.target.value.toUpperCase() })}
                aria-invalid={codeError ? true : undefined}
                maxLength={40}
                autoComplete="off"
              />
              <Button type="button" variant="outline" size="lg" onClick={handleGenerate}>
                {copy.generate}
              </Button>
            </div>
            {codeError ? (
              <FieldError>{codeError}</FieldError>
            ) : (
              <FieldDescription>{copy.codeHelp}</FieldDescription>
            )}
          </Field>
        ) : null}
      </FieldGroup>
    </DataCard>
  )
}
