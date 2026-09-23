'use client'

import type { FieldType } from '@commerce/core/metaobjects'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { FIELD_TYPE_GROUPS, fieldDialogContent, fieldTypeContent } from '@/data/metaobjects'

type FieldTypeSelectProps = {
  id: string
  value: FieldType | null
  disabled?: boolean | undefined
  onChange: (type: FieldType) => void
}

const ITEMS = Object.fromEntries(
  Object.entries(fieldTypeContent).map(([type, c]) => [type, c.label]),
)

/** Field type picker, grouped the way Shopify groups them, with a hint per type. */
export default function FieldTypeSelect({ id, value, disabled, onChange }: FieldTypeSelectProps) {
  // Render logic
  return (
    <Select
      items={ITEMS}
      value={value}
      disabled={disabled}
      onValueChange={(v) => v !== null && onChange(v as FieldType)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={fieldDialogContent.typePlaceholder} />
      </SelectTrigger>
      <SelectContent>
        {FIELD_TYPE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel>{group.label}</SelectLabel>
            {group.types.map((type) => (
              <SelectItem key={type} value={type}>
                <span className="flex flex-col">
                  <span>{fieldTypeContent[type].label}</span>
                  <span className="text-caption text-muted-foreground">
                    {fieldTypeContent[type].help}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
