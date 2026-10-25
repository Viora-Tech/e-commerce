'use client'

import { GROUP_ROWS_MAX, type GroupField } from '@commerce/core/metaobjects'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { SortableList } from '@commerce/ui/sortable'
import EmptyState from '@/components/layout/empty-state'
import { reorderLabels } from '@/data/common'
import { entryFormContent, fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { useRowIds } from '@/hooks/use-row-ids'
import ReferencePicker from './reference-picker'
import ScalarInput from './scalar-input'

type Row = Record<string, unknown>

type GroupInputProps = {
  id: string
  subfields: readonly GroupField[]
  maxRows?: number | undefined
  value: unknown
  invalid?: boolean | undefined
  onChange: (rows: Row[] | null) => void
}

/** Row fields that need the full width of a row. */
const WIDE: GroupField['type'][] = ['multi_line_text', 'link', 'choice', 'rating']

const rowsOf = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter((r): r is Row => typeof r === 'object' && r !== null && !Array.isArray(r))
    : []

/** A row's name in its header: its first filled text field, like the size "M". */
function summaryOf(row: Row, subfields: readonly GroupField[]): string | null {
  for (const sub of subfields) {
    const v = row[sub.key]
    if (sub.type === 'single_line_text' || sub.type === 'choice') {
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
  }
  return null
}

/**
 * Rows of fields, one level deep: each row a small card with its own inputs, dragged by its
 * grip to reorder, or removed. The idea of naming a row after its first text follows Instatic's
 * repeater summary (MIT); no code copied.
 */
export default function GroupInput({
  id,
  subfields,
  maxRows,
  value,
  invalid,
  onChange,
}: GroupInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)
  const { required } = useCopy(entryFormContent)
  const sortLabels = useCopy(reorderLabels)
  const rowIds = useRowIds(rowsOf(value).length)

  // Helpers
  const setRows = (rows: Row[]) => onChange(rows.length ? rows : null)
  const setCell = (rows: Row[], index: number, key: string, cell: unknown) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, [key]: cell } : r)))

  // Event handlers
  const handleRemove = (rows: Row[], index: number) => {
    rowIds.remove(index)
    setRows(rows.filter((_, i) => i !== index))
  }

  const handleReorder = (rows: Row[], next: { id: string; index: number }[]) => {
    rowIds.reorder(next.map((r) => r.id))
    setRows(
      next.flatMap((r) => {
        const row = rows[r.index]
        return row ? [row] : []
      }),
    )
  }

  // Render logic
  const rows = rowsOf(value)
  const max = Math.min(maxRows ?? GROUP_ROWS_MAX, GROUP_ROWS_MAX)
  const items = rows.map((_, index) => ({ id: rowIds.ids[index] ?? String(index), index }))

  return (
    <div id={id} className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <EmptyState
          variant="dashed"
          size="sm"
          className={invalid ? 'border-destructive' : undefined}
          body={copy.rows.empty}
        />
      ) : (
        <SortableList
          items={items}
          onReorder={(next) => handleReorder(rows, next)}
          getTitle={({ index }) => {
            const summary = summaryOf(rows[index] ?? {}, subfields)
            return summary ? `${copy.rows.row(index + 1)} · ${summary}` : copy.rows.row(index + 1)
          }}
          labels={sortLabels}
          className="flex flex-col gap-2"
          itemClassName="rounded-md"
          renderItem={({ index }, { handle }) => {
            const row = rows[index] ?? {}
            const summary = summaryOf(row, subfields)
            return (
              <div className="rounded-md border border-line bg-card">
                <div className="flex items-center gap-1 border-b border-line py-1 pr-1 pl-1">
                  {handle}
                  <span className="min-w-0 flex-1 truncate text-body-strong">
                    {copy.rows.row(index + 1)}
                    {summary ? (
                      <span className="font-normal text-muted-foreground"> · {summary}</span>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.rows.remove}
                    onClick={() => handleRemove(rows, index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
                  {subfields.map((sub) => {
                    const cellId = `${id}-${index}-${sub.key}`
                    return (
                      <div
                        key={sub.key}
                        className={cn(
                          'flex min-w-0 flex-col gap-1.5',
                          WIDE.includes(sub.type) && 'sm:col-span-2',
                        )}
                      >
                        <label
                          htmlFor={cellId}
                          className="flex items-center gap-2 text-body-strong"
                        >
                          {sub.name}
                          {sub.required ? (
                            <span className="text-caption font-normal text-muted-foreground">
                              {required}
                            </span>
                          ) : null}
                        </label>
                        {sub.type === 'file' ? (
                          <ReferencePicker
                            kind="file"
                            value={typeof row[sub.key] === 'string' ? [row[sub.key] as string] : []}
                            multiple={false}
                            onChange={(ids) => setCell(rows, index, sub.key, ids[0] ?? null)}
                          />
                        ) : (
                          <ScalarInput
                            id={cellId}
                            type={sub.type}
                            value={row[sub.key]}
                            rules={sub.validations}
                            onChange={(cell) => setCell(rows, index, sub.key, cell)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }}
        />
      )}
      {rows.length < max ? (
        <Button variant="outline" className="self-start" onClick={() => setRows([...rows, {}])}>
          <Plus />
          {copy.rows.add}
        </Button>
      ) : null}
    </div>
  )
}
