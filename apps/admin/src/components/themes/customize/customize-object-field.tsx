'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { AutoField, type Field } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { iconForField } from '@/lib/customize-field-icons'
import { type FieldLike, isImageField } from '@/lib/customize-field-shape'
import FieldFrame from './field-frame'
import ImageField from './image-field'

type CustomizeObjectFieldProps = {
  field: FieldLike
  value: unknown
  onChange: (value: unknown) => void
  name: string
  /**
   * Puck's own rendering of the object's sub-fields — unused. Puck only reads
   * a field-type override's *own* `field`/`value`/`onChange`, so this always
   * renders to nothing once every field type (including `object` itself) is
   * overridden the way `customize-editor.tsx` does: the sub-fields never get
   * their own store entry to read from. We render them ourselves below,
   * through Puck's public `AutoField`, the same way `customize-array-item.tsx`
   * already does for array items — with an explicit `value`/`onChange` per
   * sub-field, so no store lookup is needed. Kept in the props type only so
   * callers matching Puck's `fieldTypes.object` signature still type-check.
   */
  children?: ReactNode
}

/**
 * Puck's `object` field. An image-shaped object (`{ url, alt }`) gets the media
 * picker; everything else — links, buttons, a slide's nested settings — gets a
 * bordered, collapsible group, so a Hero slide's fields don't just run
 * together with the ones around it.
 */
export default function CustomizeObjectField({
  field,
  value,
  onChange,
  name,
}: CustomizeObjectFieldProps) {
  // Event handlers
  const handleSubChange = (key: string) => (subValue: unknown) =>
    onChange({ ...((value ?? {}) as Record<string, unknown>), [key]: subValue })

  // Render logic
  const objectValue = (value ?? {}) as Record<string, unknown>
  const objectFields = (field.objectFields ?? {}) as Record<string, Field>
  const label = field.label ?? name
  const Icon = iconForField(field)
  const subFields = (
    <>
      {Object.entries(objectFields).map(([key, subField]) => (
        <AutoField
          key={key}
          field={subField}
          value={objectValue[key]}
          onChange={handleSubChange(key)}
        />
      ))}
    </>
  )

  if (isImageField(field)) {
    return (
      <FieldFrame icon={Icon} label={label}>
        <ImageField field={field} value={value} onChange={onChange}>
          {subFields}
        </ImageField>
      </FieldFrame>
    )
  }

  return (
    <Collapsible className="rounded-xl border border-border">
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 px-3 py-2 text-left text-caption font-medium text-muted-foreground hover:bg-muted/60">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="flex-1">{label}</span>
        <ChevronDown
          aria-hidden
          className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3">{subFields}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
