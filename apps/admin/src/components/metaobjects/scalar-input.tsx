'use client'

import type { FieldType } from '@commerce/core/metaobjects'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type ScalarInputProps = {
  id: string
  type: FieldType
  value: unknown
  choices?: string[] | undefined
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

/** One plain value: text, number, date, link, true/false or a preset choice. */
export default function ScalarInput({
  id,
  type,
  value,
  choices,
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
  if (type === 'single_line_text' && choices?.length) {
    return (
      <Select
        items={Object.fromEntries(choices.map((c) => [c, c]))}
        value={text(value) || null}
        onValueChange={(v) => onChange(v === null ? '' : String(v))}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={invalid || undefined}>
          <SelectValue placeholder={copy.choose} />
        </SelectTrigger>
        <SelectContent>
          {choices.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
