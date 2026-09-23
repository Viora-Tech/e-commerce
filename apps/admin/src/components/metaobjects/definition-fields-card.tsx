'use client'

import type { FieldDefinition } from '@commerce/core/metaobjects'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { definitionFormContent, fieldTypeContent } from '@/data/metaobjects'
import FieldDialog from './field-dialog'

type DefinitionFieldsCardProps = {
  fields: FieldDefinition[]
  targets: { id: string; name: string }[]
  onChange: (fields: FieldDefinition[]) => void
}

const copy = definitionFormContent.fields

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/** The definition's fields in order, each editable in a dialog. */
export default function DefinitionFieldsCard({
  fields,
  targets,
  onChange,
}: DefinitionFieldsCardProps) {
  // Hooks
  const [editing, setEditing] = useState<number | 'new' | null>(null)

  // Event handlers
  const handleSave = (field: FieldDefinition) => {
    if (editing === 'new') onChange([...fields, field])
    else if (editing !== null) onChange(fields.map((f, i) => (i === editing ? field : f)))
    setEditing(null)
  }

  // Render logic
  const current = typeof editing === 'number' ? (fields[editing] ?? null) : null
  const takenKeys = fields.filter((_, i) => i !== editing).map((f) => f.key)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.body}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {fields.length === 0 ? (
          <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-body text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {fields.map((f, i) => (
              <li key={f.key} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-body-strong">{f.name}</span>
                    {f.required ? <Badge variant="secondary">{copy.required}</Badge> : null}
                    {f.list ? <Badge variant="outline">{copy.list}</Badge> : null}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {fieldTypeContent[f.type].label} · {f.key}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.moveUp}
                  disabled={i === 0}
                  onClick={() => onChange(move(fields, i, i - 1))}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.moveDown}
                  disabled={i === fields.length - 1}
                  onClick={() => onChange(move(fields, i, i + 1))}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.edit}
                  onClick={() => setEditing(i)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.remove}
                  onClick={() => onChange(fields.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" className="self-start" onClick={() => setEditing('new')}>
          <Plus />
          {copy.add}
        </Button>
      </CardContent>
      <FieldDialog
        open={editing !== null}
        field={current}
        takenKeys={takenKeys}
        targets={targets}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </Card>
  )
}
