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
import { useCopy } from '@/hooks/use-copy'

type FieldTypeSelectProps = {
  id: string
  value: FieldType | null
  disabled?: boolean | undefined
  onChange: (type: FieldType) => void
}

/** "What goes in it" picker: field types in plain words, grouped, with a hint per type. */
export default function FieldTypeSelect({ id, value, disabled, onChange }: FieldTypeSelectProps) {
  // Hooks
  const copy = useCopy(fieldTypeContent)
  const { typePlaceholder: placeholder } = useCopy(fieldDialogContent)

  // Render logic
  const items = Object.fromEntries(Object.entries(copy.types).map(([type, c]) => [type, c.label]))

  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(v) => v !== null && onChange(v as FieldType)}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {FIELD_TYPE_GROUPS.map((group) => (
          <SelectGroup key={group.id}>
            <SelectLabel>{copy.groups[group.id]}</SelectLabel>
            {group.types.map((type) => (
              <SelectItem key={type} value={type}>
                <span className="flex flex-col">
                  <span>{copy.types[type].label}</span>
                  <span className="text-caption text-muted-foreground">
                    {copy.types[type].help}
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
