'use client'

import type { FieldType, FieldValidations } from '@commerce/core/metaobjects'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import ChoiceInput from './choice-input'
import ColourInput from './colour-input'
import DateTimeInput from './date-time-input'
import LinkInput from './link-input'
import MeasurementInput from './measurement-input'
import MoneyFieldInput from './money-field-input'
import RatingInput from './rating-input'

type ScalarInputProps = {
  id: string
  type: FieldType
  value: unknown
  /** The field's rules: its choices, currency, unit kind or number of stars. */
  rules?: FieldValidations | undefined
  invalid?: boolean | undefined
  onChange: (value: unknown) => void
}

const INPUT_TYPE: Partial<Record<FieldType, string>> = {
  number_integer: 'number',
  number_decimal: 'number',
  date: 'date',
  url: 'url',
}

const text = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''

/**
 * One plain value: text, number, date, link, true/false, a choice, a colour, a date and
 * time, money, a button link, stars or a measurement.
 */
export default function ScalarInput({
  id,
  type,
  value,
  rules,
  invalid,
  onChange,
}: ScalarInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)

  // Early returns
  if (type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <Switch id={id} checked={value === true} onCheckedChange={(v) => onChange(Boolean(v))} />
        <Label htmlFor={id} className="text-body font-normal">
          {value === true ? copy.yes : copy.no}
        </Label>
      </div>
    )
  }
  if (type === 'multi_line_text') {
    return (
      <Textarea
        id={id}
        size="lg"
        rows={4}
        value={text(value)}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  if ((type === 'single_line_text' && rules?.choices?.length) || type === 'choice') {
    return (
      <ChoiceInput
        id={id}
        choices={rules?.choices ?? []}
        multiple={false}
        value={value}
        invalid={invalid}
        onChange={(v) => onChange(v ?? '')}
      />
    )
  }
  if (type === 'color') {
    return <ColourInput id={id} value={value} invalid={invalid} onChange={onChange} />
  }
  if (type === 'date_time') {
    return <DateTimeInput id={id} value={value} invalid={invalid} onChange={onChange} />
  }
  if (type === 'money') {
    return (
      <MoneyFieldInput id={id} value={value} rules={rules} invalid={invalid} onChange={onChange} />
    )
  }
  if (type === 'link') {
    return <LinkInput id={id} value={value} invalid={invalid} onChange={onChange} />
  }
  if (type === 'rating') {
    return <RatingInput id={id} value={value} rules={rules} onChange={onChange} />
  }
  if (type === 'measurement') {
    return (
      <MeasurementInput id={id} value={value} rules={rules} invalid={invalid} onChange={onChange} />
    )
  }

  // Render logic
  return (
    <Input
      id={id}
      size="lg"
      type={INPUT_TYPE[type] ?? 'text'}
      inputMode={
        type === 'number_integer' ? 'numeric' : type === 'number_decimal' ? 'decimal' : undefined
      }
      step={type === 'number_decimal' ? 'any' : undefined}
      value={text(value)}
      placeholder={type === 'url' ? 'https://' : undefined}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
