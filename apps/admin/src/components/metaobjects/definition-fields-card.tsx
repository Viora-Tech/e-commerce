'use client'

import type { FieldDefinition } from '@commerce/core/metaobjects'
import { Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { SortableList } from '@commerce/ui/sortable'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { reorderLabels } from '@/data/common'
import { definitionFormContent, fieldTypeContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import FieldDialog from './field-dialog'

type DefinitionFieldsCardProps = {
  fields: FieldDefinition[]
  /** Per field key, how many saved entries hold a value in it. */
  filled: Record<string, number>
  targets: { id: string; name: string }[]
  onChange: (fields: FieldDefinition[]) => void
}

/** The definition's fields in order, each editable in a dialog. */
export default function DefinitionFieldsCard({
  fields,
  filled,
  targets,
  onChange,
}: DefinitionFieldsCardProps) {
  // Hooks
  const { fields: copy } = useCopy(definitionFormContent)
  const { types } = useCopy(fieldTypeContent)
  const sortLabels = useCopy(reorderLabels)
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
    <DataCard title={copy.heading} subtitle={copy.body} bodyClassName="flex flex-col gap-3">
      {fields.length === 0 ? (
        <EmptyState variant="dashed" size="sm" body={copy.empty} />
      ) : (
        <SortableList
          items={fields.map((f) => ({ id: f.key, field: f }))}
          onReorder={(next) => onChange(next.map((r) => r.field))}
          getTitle={(r) => r.field.name}
          labels={sortLabels}
          className="flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line"
          renderItem={({ field: f }, { handle }) => {
            const i = fields.indexOf(f)
            return (
              <div className="flex items-center gap-3 py-2.5 pr-3 pl-1.5">
                {handle}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-body-strong">{f.name}</span>
                    {f.required ? <Badge variant="secondary">{copy.required}</Badge> : null}
                    {f.list ? <Badge variant="outline">{copy.list}</Badge> : null}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {types[f.type].label} · {f.key}
                  </span>
                </div>
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
              </div>
            )
          }}
        />
      )}
      <Button variant="outline" className="self-end" onClick={() => setEditing('new')}>
        <Plus />
        {copy.add}
      </Button>
      <FieldDialog
        open={editing !== null}
        field={current}
        takenKeys={takenKeys}
        filled={current ? (filled[current.key] ?? 0) : 0}
        targets={targets}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </DataCard>
  )
}
