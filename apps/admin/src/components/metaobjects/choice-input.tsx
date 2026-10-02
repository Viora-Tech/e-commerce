'use client'

import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type ChoiceInputProps = {
  id: string
  choices: readonly string[]
  /** Tick boxes for several choices; a drop-down for one. */
  multiple: boolean
  value: unknown
  invalid?: boolean | undefined
  onChange: (value: unknown) => void
}

const picked = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : typeof value === 'string' && value
      ? [value]
      : []

/** Pick from the field's own list: a drop-down for one choice, tick boxes for several. */
export default function ChoiceInput({
  id,
  choices,
  multiple,
  value,
  invalid,
  onChange,
}: ChoiceInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)

  // Event handlers
  const handleTick = (choice: string, on: boolean) => {
    const current = picked(value)
    // Keep the field's own order, whatever order they were ticked in.
    onChange(choices.filter((c) => (c === choice ? on : current.includes(c))))
  }

  // Early returns
  if (!multiple) {
    return (
      <Select
        items={Object.fromEntries(choices.map((c) => [c, c]))}
        value={picked(value)[0] ?? null}
        onValueChange={(v) => onChange(v === null ? null : String(v))}
      >
        <SelectTrigger
          id={id}
          size="lg"
          className="w-full sm:max-w-80"
          aria-invalid={invalid || undefined}
        >
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
  const current = picked(value)

  return (
    <fieldset
      id={id}
      className="m-0 grid min-w-0 grid-cols-2 gap-x-4 gap-y-2.5 border-0 p-0 sm:grid-cols-3"
    >
      {choices.map((c, i) => (
        <div key={c} className="flex min-w-0 items-center gap-2">
          <Checkbox
            id={`${id}-${i}`}
            checked={current.includes(c)}
            aria-invalid={invalid || undefined}
            onCheckedChange={(on) => handleTick(c, Boolean(on))}
          />
          <Label htmlFor={`${id}-${i}`} className="truncate text-body font-normal">
            {c}
          </Label>
        </div>
      ))}
    </fieldset>
  )
}
