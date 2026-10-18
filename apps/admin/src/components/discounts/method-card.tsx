'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import DataCard from '@/components/layout/data-card'
import { discountFormContent } from '@/data/discounts'
import type { DiscountFormState } from './form-state'
import { randomCode } from './form-state'

type MethodCardProps = {
  form: Pick<DiscountFormState, 'title' | 'kind' | 'code' | 'method'>
  titleError?: string | undefined
  codeError?: string | undefined
  onChange: (patch: Partial<DiscountFormState>) => void
}

type RadioCardProps = {
  name: string
  value: string
  checked: boolean
  label: string
  help: string
}

const copy = discountFormContent.method
const KINDS = ['code', 'automatic'] as const
const METHODS = ['percent', 'fixed', 'free_shipping'] as const

/* Shopify-style method cards: a bordered tile that fills soft green when picked. */
function RadioCard({ name, value, checked, label, help }: RadioCardProps) {
  return (
    <FieldLabel
      htmlFor={`${name}-${value}`}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 font-normal transition-colors hover:bg-muted',
        checked && 'border-primary bg-primary-soft',
      )}
    >
      <RadioGroupItem id={`${name}-${value}`} value={value} className="mt-0.5" />
      <span className="flex flex-col gap-0.5">
        <span className="text-body-strong">{label}</span>
        <span className="text-caption">{help}</span>
      </span>
    </FieldLabel>
  )
}

export default function MethodCard({ form, titleError, codeError, onChange }: MethodCardProps) {
  // Event handlers
  const handleGenerate = () => onChange({ code: randomCode() })

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        <Field>
          <FieldLabel>{copy.kindLabel}</FieldLabel>
          <RadioGroup
            value={form.kind}
            onValueChange={(v) => onChange({ kind: v as DiscountFormState['kind'] })}
            className="grid gap-3 md:grid-cols-2"
          >
            {KINDS.map((k) => (
              <RadioCard
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
        <Field>
          <FieldLabel>{copy.methodLabel}</FieldLabel>
          <RadioGroup
            value={form.method}
            onValueChange={(v) => onChange({ method: v as DiscountFormState['method'] })}
            className="grid gap-3 md:grid-cols-3"
          >
            {METHODS.map((m) => (
              <RadioCard
                key={m}
                name="method"
                value={m}
                checked={form.method === m}
                label={copy.methods[m].label}
                help={copy.methods[m].help}
              />
            ))}
          </RadioGroup>
        </Field>
        <Field data-invalid={titleError ? true : undefined}>
          <FieldLabel htmlFor="discount-title">
            {copy.title}
            <span aria-hidden="true">*</span>
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
              <span aria-hidden="true">*</span>
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
