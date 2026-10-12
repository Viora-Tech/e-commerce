'use client'

import type { AlternateKind } from '@commerce/core/theme'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type TemplateSelectFieldProps = {
  kind: AlternateKind
  value: string
  onChange: (suffix: string) => void
  /** A visible label (inside a dialog); a card's title labels it otherwise. */
  label?: string | undefined
  id?: string | undefined
}

const DEFAULT = '__default'

/**
 * Which alternate of the live theme lays this resource out: the default, or one of the
 * `<kind>.<suffix>` templates created in Customize. An unknown stored suffix stays listed so
 * saving never drops it silently.
 */
export default function TemplateSelectField({
  kind,
  value,
  onChange,
  label,
  id,
}: TemplateSelectFieldProps) {
  // Hooks
  const copy = useCopy(customizeContent.assign)
  const [suffixes, setSuffixes] = useState<string[]>([])

  useEffect(() => {
    let active = true
    api.themes.templates
      .live()
      .then((rows) => {
        if (!active) return
        setSuffixes(rows.filter((r) => r.template === kind && r.suffix).map((r) => r.suffix))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [kind])

  // Event handlers
  const handleChange = (next: unknown) => {
    if (typeof next === 'string') onChange(next === DEFAULT ? '' : next)
  }

  // Render logic
  const known = value && !suffixes.includes(value) ? [...suffixes, value] : suffixes
  const items = [
    { value: DEFAULT, label: copy.default[kind] },
    ...known.map((s) => ({ value: s, label: s })),
  ]

  return (
    <Field>
      {label ? <FieldLabel htmlFor={id}>{label}</FieldLabel> : null}
      <Select items={items} value={value || DEFAULT} onValueChange={handleChange}>
        <SelectTrigger id={id} className="w-full" aria-label={label ? undefined : copy.heading}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>{copy.help}</FieldDescription>
    </Field>
  )
}
