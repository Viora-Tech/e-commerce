'use client'

import { safeColour } from '@commerce/blocks/element-style'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useId } from 'react'
import { customizeContent } from '@/data/customize'
import type { FieldLike } from '@/lib/customize-field-shape'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import FieldFrame from './field-frame'

type Option = { label: string; value: string }

type ColourChoiceFieldProps = {
  label: string
  field: FieldLike
  value: Record<string, unknown>
  onChange: (value: { token: string; custom: string }) => void
}

/**
 * A colour that prefers the theme: pick one of its colours (so colour schemes
 * and dark mode follow), or "Custom colour" to type any CSS colour. A custom
 * value that isn't a colour shows as invalid and renders as nothing.
 */
export default function ColourChoiceField({
  label,
  field,
  value,
  onChange,
}: ColourChoiceFieldProps) {
  // Hooks
  const id = useId()

  // Render logic
  const tokenField = (field.objectFields?.token ?? {}) as { options?: Option[] }
  const customField = (field.objectFields?.custom ?? {}) as { label?: string }
  const options = tokenField.options ?? []
  const token = typeof value.token === 'string' ? value.token : 'inherit'
  const custom = typeof value.custom === 'string' ? value.custom : ''
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]))
  const valid = safeColour(custom)

  return (
    <FieldFrame label={label} htmlFor={id}>
      <div className="flex flex-col gap-2">
        <Select
          items={items}
          value={token}
          onValueChange={(next) => {
            if (typeof next === 'string') onChange({ token: next, custom })
          }}
        >
          <SelectTrigger id={id} className={cn(FIELD_CONTROL, 'w-full')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {token === 'custom' ? (
          <div className="relative">
            <span
              aria-hidden
              className="absolute top-1/2 left-2 size-4 -translate-y-1/2 rounded-sm ring-1 ring-border"
              style={valid ? { backgroundColor: valid } : undefined}
            />
            <Input
              value={custom}
              onChange={(e) => onChange({ token, custom: e.target.value })}
              placeholder={customizeContent.colourChoice.placeholder}
              aria-label={customField.label ?? label}
              aria-invalid={custom !== '' && !valid}
              size="lg"
              className={cn(FIELD_CONTROL, 'pl-8 font-mono text-xs')}
            />
          </div>
        ) : null}
      </div>
    </FieldFrame>
  )
}
