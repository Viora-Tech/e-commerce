'use client'

import {
  isLoop,
  type LoopBinding,
  type LoopSpec,
  linkLoop,
  unlinkLoop,
} from '@commerce/core/dynamic-sources'
import { withFreshBlockIds } from '@commerce/core/theme'
import { DynamicSource, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { SortableList } from '@commerce/ui/sortable'
import type { Field } from '@puckeditor/core'
import { useState } from 'react'
import { arrayItemSortLabels, customizeContent } from '@/data/customize'
import { dynamicSourcesContent } from '@/data/dynamic-sources'
import { type FieldLike, isImageField } from '@/lib/customize-field-shape'
import { isLiquidBlocks, liquidItemFields, liquidItemTitle } from '@/lib/customize-liquid-blocks'
import { itemKinds } from '@/lib/customize-loops'
import CustomizeArrayItem from './customize-array-item'
import FieldFrame from './field-frame'
import LoopDialog from './loop-dialog'
import LoopLinkedPanel from './loop-linked-panel'

type ArrayFieldLike = {
  label?: string
  metadata?: unknown
  arrayFields: Record<string, Field>
  defaultItemProps?: Record<string, unknown> | ((index: number) => Record<string, unknown>)
  getItemSummary?: (item: Record<string, unknown>, index?: number) => string
  min?: number
  max?: number
}

type Rows = Record<string, unknown>[]

type CustomizeArrayFieldProps = {
  field: ArrayFieldLike
  /** The rows, or a list filled from store data (`$loop`, see @commerce/core/dynamic-sources). */
  value: Rows | LoopBinding | undefined
  onChange: (value: Rows | LoopBinding) => void
  readOnly?: boolean
  name: string
}

type Row = { id: string; item: Record<string, unknown>; index: number }

const copy = customizeContent.array
const loopCopy = dynamicSourcesContent.loops

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
 * `text`/`number`/`select`/… overrides. "Use content from…" fills the rows from a
 * content type or a collection instead; while linked the list is read-only.
 */
export default function CustomizeArrayField({
  field,
  value,
  onChange,
  readOnly,
  name,
}: CustomizeArrayFieldProps) {
  // Hooks
  const [linking, setLinking] = useState(false)

  // Helpers
  const titleOf = (item: Record<string, unknown>, index: number) =>
    field.getItemSummary?.(item, index) || liquidItemTitle(field, item) || copy.itemFallback(index)
  const list = (): Rows => (Array.isArray(value) ? value : [])

  // Event handlers
  const handleReorder = (rows: Row[]) => onChange(rows.map((r) => r.item))

  const handleUpdate = (index: number, key: string, itemValue: unknown) =>
    onChange(list().map((item, i) => (i === index ? { ...item, [key]: itemValue } : item)))

  const handleDuplicate = (index: number) =>
    onChange([
      ...list().slice(0, index + 1),
      // Blocks nested in the item's slots (a tab's content) get new ids in the copy.
      withFreshBlockIds({ ...list()[index] }),
      ...list().slice(index + 1),
    ])

  const handleDelete = (index: number) => onChange(list().filter((_, i) => i !== index))

  const handleAdd = () => {
    const defaults =
      typeof field.defaultItemProps === 'function'
        ? field.defaultItemProps(list().length)
        : (field.defaultItemProps ?? {})
    onChange([...list(), { ...defaults }])
  }

  const handleLink = (spec: LoopSpec) => {
    onChange(linkLoop(spec.source, spec.limit, spec.map, value))
    setLinking(false)
  }

  const handleUnlink = () => {
    if (isLoop(value)) onChange(unlinkLoop(value) as Rows)
  }

  // Render logic
  const items = list()
  const label = field.label ?? name
  const linked = isLoop(value) ? value : null
  const kinds = itemKinds(field.arrayFields as Record<string, FieldLike>)
  const fieldLabels = Object.fromEntries(
    Object.entries(field.arrayFields).map(([key, def]) => [key, (def as FieldLike).label ?? key]),
  )
  const rows: Row[] = items.map((item, index) => ({ id: `${name}-${index}`, item, index }))
  // An imported section's blocks are copied or removed, not added blank (their type is unknown).
  const liquid = isLiquidBlocks(field.arrayFields)
  const atMax = field.max !== undefined && items.length >= field.max
  const canDelete = items.length > (field.min ?? 0)

  return (
    <FieldFrame label={label}>
      <div className="flex flex-col gap-2">
        {linked ? (
          <LoopLinkedPanel
            spec={linked.$loop}
            labels={fieldLabels}
            readOnly={readOnly}
            onChange={() => setLinking(true)}
            onUnlink={handleUnlink}
          />
        ) : (
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
                arrayFields={liquidItemFields(field.arrayFields, row.item)}
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
        )}
        {linked || readOnly || liquid ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {atMax ? null : (
              <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
                <Plus aria-hidden />
                {copy.addItem}
              </Button>
            )}
            {Object.keys(kinds).length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLinking(true)}>
                <DynamicSource aria-hidden />
                {loopCopy.use}
              </Button>
            ) : null}
          </div>
        )}
      </div>
      {linking ? (
        <LoopDialog
          kinds={kinds}
          labels={fieldLabels}
          current={linked?.$loop ?? null}
          onCancel={() => setLinking(false)}
          onConfirm={handleLink}
        />
      ) : null}
    </FieldFrame>
  )
}
