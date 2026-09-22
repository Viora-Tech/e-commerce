'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { api } from '@/lib/api-client'

type TemplateSelectCardProps = {
  kind: 'product' | 'collection'
  value: string
  onChange: (suffix: string) => void
}

const copy = customizeContent.assign
const DEFAULT = '__default'

/** Shopify's "Theme template" card: which alternate of the live theme lays this resource out. */
export default function TemplateSelectCard({ kind, value, onChange }: TemplateSelectCardProps) {
  // Hooks
  const [suffixes, setSuffixes] = useState<string[]>([])

  useEffect(() => {
    let active = true
    api.themes
      .list()
      .then((themes) => {
        const live = themes.find((t) => t.role === 'main')
        return live ? api.themes.templates.list({ themeId: live.id }) : []
      })
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <Select items={items} value={value || DEFAULT} onValueChange={handleChange}>
            <SelectTrigger className="w-full" aria-label={copy.heading}>
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
      </CardContent>
    </Card>
  )
}
