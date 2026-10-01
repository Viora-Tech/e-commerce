'use client'

import type { FieldDefinition } from '@commerce/core/metaobjects'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { definitionFormContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import ToggleField from './toggle-field'

type DefinitionSettingsCardProps = {
  fields: FieldDefinition[]
  displayNameKey: string | null
  storefrontAccess: boolean
  onChange: (patch: { displayNameKey?: string | null; storefrontAccess?: boolean }) => void
}

const NONE = '__handle'

/** Which field names an entry, and whether the storefront may read the entries. */
export default function DefinitionSettingsCard({
  fields,
  displayNameKey,
  storefrontAccess,
  onChange,
}: DefinitionSettingsCardProps) {
  // Hooks
  const copy = useCopy(definitionFormContent)

  // Render logic
  const textFields = fields.filter(
    (f) => !f.list && ['single_line_text', 'number_integer', 'number_decimal'].includes(f.type),
  )
  const items = {
    [NONE]: copy.display.none,
    ...Object.fromEntries(textFields.map((f) => [f.key, f.name])),
  }
  const value = textFields.some((f) => f.key === displayNameKey) ? (displayNameKey as string) : NONE

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{copy.display.heading}</CardTitle>
          <CardDescription>{copy.display.body}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            items={items}
            value={value}
            onValueChange={(v) =>
              onChange({ displayNameKey: v === NONE || v === null ? null : String(v) })
            }
          >
            <SelectTrigger className="w-full" aria-label={copy.display.heading}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(items).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.access.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <ToggleField
            id="definition-storefront"
            label={copy.access.storefront}
            help={copy.access.storefrontHelp}
            checked={storefrontAccess}
            onChange={(v) => onChange({ storefrontAccess: v })}
          />
        </CardContent>
      </Card>
    </>
  )
}
