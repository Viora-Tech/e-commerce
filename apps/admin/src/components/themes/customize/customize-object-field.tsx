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
import {
  type FieldLike,
  isImageField,
  isLinkField,
  isResponsiveNumberField,
  isSectionSettingsField,
} from '@/lib/customize-field-shape'
import FieldFrame from './field-frame'
import ImageField from './image-field'
import ResponsiveNumberField from './responsive-number-field'
import SectionSettingsGroups from './section-settings-groups'

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
 * Puck's `object` field, by shape: an image (`{ url, alt }`) gets the media
 * picker, a button or link (`{ label, href }`) its two fields shown open,
 * a mobile/tablet/desktop number one compact row, the shared section
 * settings the grouped panel — and anything else a quiet collapsible group.
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

  // Early returns
  const objectValue = (value ?? {}) as Record<string, unknown>
  const objectFields = (field.objectFields ?? {}) as Record<string, Field>
  const label = field.label ?? name
  if (isSectionSettingsField(field, name)) {
    return <SectionSettingsGroups field={field} value={objectValue} onChange={onChange} />
  }
  if (isResponsiveNumberField(field)) {
    return (
      <ResponsiveNumberField
        label={label}
        field={field}
        value={objectValue}
        onChange={(key, next) => handleSubChange(key)(next)}
      />
    )
  }

  // Render logic
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
      <FieldFrame label={label}>
        <ImageField field={field} value={value} onChange={onChange}>
          {subFields}
        </ImageField>
      </FieldFrame>
    )
  }

  // A button or link is two short fields (label + where it goes): shown open,
  // since hiding them behind a toggle only adds a click.
  if (isLinkField(field)) {
    return (
      <FieldFrame label={label}>
        <div className="flex flex-col gap-3 rounded-lg border border-border p-2.5">{subFields}</div>
      </FieldFrame>
    )
  }

  return (
    <Collapsible className="rounded-lg border border-border">
      <CollapsibleTrigger className="group flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-medium text-foreground/80 hover:bg-muted/60">
        <Icon aria-hidden weight="light" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{label}</span>
        <ChevronDown
          aria-hidden
          className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-4 border-t border-border p-2.5">{subFields}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
