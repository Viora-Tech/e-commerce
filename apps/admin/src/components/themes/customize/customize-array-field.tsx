'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { SortableList } from '@commerce/ui/sortable'
import type { Field } from '@puckeditor/core'
import { arrayItemSortLabels, customizeContent } from '@/data/customize'
import { type FieldLike, isImageField } from '@/lib/customize-field-shape'
import CustomizeArrayItem from './customize-array-item'
import FieldFrame from './field-frame'

type ArrayFieldLike = {
  label?: string
  arrayFields: Record<string, Field>
  defaultItemProps?: Record<string, unknown> | ((index: number) => Record<string, unknown>)
  getItemSummary?: (item: Record<string, unknown>, index?: number) => string
  min?: number
  max?: number
}

type CustomizeArrayFieldProps = {
  field: ArrayFieldLike
  value: Record<string, unknown>[] | undefined
  onChange: (value: Record<string, unknown>[]) => void
  readOnly?: boolean
  name: string
}

type Row = { id: string; item: Record<string, unknown>; index: number }

const copy = customizeContent.array

/** The image sub-field's value, for the card thumbnail — the first image-shaped `arrayFields` entry. */
function thumbnailOf(item: Record<string, unknown>, arrayFields: Record<string, Field>) {
  const imageKey = Object.entries(arrayFields).find(([, def]) =>
    isImageField(def as FieldLike),
  )?.[0]
  if (!imageKey) return undefined
  const image = item[imageKey] as { url?: string } | undefined
  return image?.url || undefined
}

/**
 * Puck's `array` field: each item as a collapsible, reorderable card — a Hero
 * slide, a logo, an FAQ entry — instead of Puck's own flat item list. Each
 * card's own fields render through `AutoField`, so they still go through our
 * `text`/`number`/`select`/… overrides.
 */
export default function CustomizeArrayField({
  field,
  value,
  onChange,
  readOnly,
  name,
}: CustomizeArrayFieldProps) {
  // Helpers
  const titleOf = (item: Record<string, unknown>, index: number) =>
    field.getItemSummary?.(item, index) || copy.itemFallback(index)

  // Event handlers
  const handleReorder = (rows: Row[]) => onChange(rows.map((r) => r.item))

  const handleUpdate = (index: number, key: string, itemValue: unknown) =>
    onChange((value ?? []).map((item, i) => (i === index ? { ...item, [key]: itemValue } : item)))

  const handleDuplicate = (index: number) =>
    onChange([
      ...(value ?? []).slice(0, index + 1),
      { ...(value ?? [])[index] },
      ...(value ?? []).slice(index + 1),
    ])

  const handleDelete = (index: number) => onChange((value ?? []).filter((_, i) => i !== index))

  const handleAdd = () => {
    const defaults =
      typeof field.defaultItemProps === 'function'
        ? field.defaultItemProps((value ?? []).length)
        : (field.defaultItemProps ?? {})
    onChange([...(value ?? []), { ...defaults }])
  }

  // Render logic
  const items = value ?? []
  const label = field.label ?? name
  const rows: Row[] = items.map((item, index) => ({ id: `${name}-${index}`, item, index }))
  const atMax = field.max !== undefined && items.length >= field.max
  const canDelete = items.length > (field.min ?? 0)

  return (
    <FieldFrame label={label}>
      <div className="flex flex-col gap-2">
        <SortableList
          items={rows}
          onReorder={handleReorder}
          getTitle={(row) => titleOf(row.item, row.index)}
          labels={arrayItemSortLabels}
          className="flex flex-col gap-2"
          renderItem={(row, { handle }) => (
            <CustomizeArrayItem
              item={row.item}
              title={titleOf(row.item, row.index)}
              thumbnail={thumbnailOf(row.item, field.arrayFields)}
              arrayFields={field.arrayFields}
              handle={handle}
              canDuplicate={!atMax}
              canDelete={canDelete}
              readOnly={readOnly}
              onUpdate={(key, itemValue) => handleUpdate(row.index, key, itemValue)}
              onDuplicate={() => handleDuplicate(row.index)}
              onDelete={() => handleDelete(row.index)}
            />
          )}
        />
        {readOnly || atMax ? null : (
          <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
            <Plus aria-hidden />
            {copy.addItem}
          </Button>
        )}
      </div>
    </FieldFrame>
  )
}
