'use client'

import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { automationEditorContent } from '@/data/automations'
import { useCopy } from '@/hooks/use-copy'

type Row = { name: string; value: string }

type KeyValueInputProps = {
  id: string
  rows: Row[]
  max: number
  onChange: (rows: Row[]) => void
}

/** Name/value rows (HTTP headers), added and removed one at a time. */
export default function KeyValueInput({ id, rows, max, onChange }: KeyValueInputProps) {
  // Hooks
  const { fields: copy } = useCopy(automationEditorContent)

  // Event handlers
  const handleRow = (i: number, patch: Partial<Row>) =>
    onChange(rows.map((r, at) => (at === i ? { ...r, ...patch } : r)))

  // Render logic
  return (
    <div id={id} className="flex flex-col gap-2">
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no id and are edited in place
        <div key={i} className="flex items-center gap-2">
          <Input
            value={row.name}
            aria-label={copy.headerName}
            placeholder={copy.headerName}
            onChange={(e) => handleRow(i, { name: e.target.value })}
          />
          <Input
            value={row.value}
            aria-label={copy.headerValue}
            placeholder={copy.headerValue}
            onChange={(e) => handleRow(i, { value: e.target.value })}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.remove(row.name || copy.headerName)}
            onClick={() => onChange(rows.filter((_, at) => at !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={rows.length >= max}
        onClick={() => onChange([...rows, { name: '', value: '' }])}
      >
        <Plus aria-hidden="true" />
        {copy.addRow}
      </Button>
    </div>
  )
}
