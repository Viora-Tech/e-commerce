'use client'

import {
  GROUP_FIELD_TYPES,
  GROUP_FIELDS_MAX,
  type GroupField,
  type GroupFieldType,
  keyFromName,
} from '@commerce/core/metaobjects'
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldDescription } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { type ReactNode, useId, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import { fieldDialogContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import FieldTypeSelect from './field-type-select'

type GroupFieldsEditorProps = {
  subfields: GroupField[]
  /** Row fields whose kind of value is fixed because rows already use them. */
  lockedKeys: readonly string[]
  /** The limits a row field's type needs (choices, unit kind, currency, stars). */
  renderRules: (sub: GroupField, onChange: (next: GroupField) => void) => ReactNode
  onChange: (subfields: GroupField[]) => void
}

/** Types whose row field needs a rule picked before it can be saved. */
const NEEDS_RULES: GroupFieldType[] = ['choice', 'measurement', 'money', 'rating']

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/** `size`, or `size_2` when another row field already has that key. */
function freeKey(name: string, taken: readonly string[]): string {
  const base = keyFromName(name || 'field')
  if (!taken.includes(base)) return base
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 60)}_${n}`
    if (!taken.includes(candidate)) return candidate
  }
}

/**
 * The fields every row of a group has (Payload's array field and Instatic's repeater gave the
 * idea; no code copied). A new row field's key follows its name; a saved one keeps its key.
 */
export default function GroupFieldsEditor({
  subfields,
  lockedKeys,
  renderRules,
  onChange,
}: GroupFieldsEditorProps) {
  // Hooks
  const copy = useCopy(fieldDialogContent)
  const id = useId()
  const [savedKeys] = useState(() => subfields.map((s) => s.key))

  // Helpers
  const replace = (index: number, next: GroupField) =>
    onChange(subfields.map((s, i) => (i === index ? next : s)))

  // Event handlers
  const handleName = (index: number, name: string) => {
    const sub = subfields[index]
    if (!sub) return
    const others = subfields.filter((_, i) => i !== index).map((s) => s.key)
    const key = savedKeys.includes(sub.key) ? sub.key : freeKey(name, others)
    replace(index, { ...sub, name, key })
  }

  const handleType = (index: number, type: GroupFieldType) => {
    const sub = subfields[index]
    if (sub) replace(index, { key: sub.key, name: sub.name, required: sub.required, type })
  }

  const handleAdd = () =>
    onChange([
      ...subfields,
      {
        key: freeKey(
          '',
          subfields.map((s) => s.key),
        ),
        name: '',
        type: 'single_line_text',
        required: false,
      },
    ])

  // Render logic
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-body-strong">{copy.rows.heading}</span>
        <FieldDescription>{copy.rows.help}</FieldDescription>
      </div>
      {subfields.length === 0 ? (
        <EmptyState variant="dashed" size="sm" body={copy.rows.empty} />
      ) : (
        <ul className="flex flex-col gap-2">
          {subfields.map((sub, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a new row field's key follows its name as it is typed, so the position is the stable identity.
            <li key={i} className="flex flex-col gap-3 rounded-md border border-line bg-card p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Input
                  size="lg"
                  aria-label={copy.rows.name}
                  value={sub.name}
                  placeholder={copy.rows.namePlaceholder}
                  onChange={(e) => handleName(i, e.target.value)}
                />
                <FieldTypeSelect
                  id={`${id}-type-${i}`}
                  value={sub.type}
                  only={GROUP_FIELD_TYPES}
                  disabled={lockedKeys.includes(sub.key)}
                  onChange={(type) => handleType(i, type as GroupFieldType)}
                />
              </div>
              {NEEDS_RULES.includes(sub.type) ? renderRules(sub, (next) => replace(i, next)) : null}
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-required-${i}`}
                  checked={sub.required}
                  onCheckedChange={(checked) => replace(i, { ...sub, required: Boolean(checked) })}
                />
                <Label htmlFor={`${id}-required-${i}`} className="text-body font-normal">
                  {copy.rows.required}
                </Label>
                <span className="ml-auto truncate font-mono text-caption text-muted-foreground">
                  {sub.key}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.rows.moveUp}
                  disabled={i === 0}
                  onClick={() => onChange(move(subfields, i, i - 1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.rows.moveDown}
                  disabled={i === subfields.length - 1}
                  onClick={() => onChange(move(subfields, i, i + 1))}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.rows.remove}
                  onClick={() => onChange(subfields.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {subfields.length < GROUP_FIELDS_MAX ? (
        <Button variant="outline" className="self-start" onClick={handleAdd}>
          <Plus />
          {copy.rows.add}
        </Button>
      ) : null}
    </div>
  )
}
