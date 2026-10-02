'use client'

import { GROUP_ROWS_MAX, type GroupField } from '@commerce/core/metaobjects'
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { entryFormContent, fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
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

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

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
 * Rows of fields, one level deep: each row a small card with its own inputs, moved up or
 * down, or removed. The idea of naming a row after its first text follows Instatic's
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

  // Helpers
  const setRows = (rows: Row[]) => onChange(rows.length ? rows : null)
  const setCell = (rows: Row[], index: number, key: string, cell: unknown) =>
    setRows(rows.map((r, i) => (i === index ? { ...r, [key]: cell } : r)))

  // Render logic
  const rows = rowsOf(value)
  const max = Math.min(maxRows ?? GROUP_ROWS_MAX, GROUP_ROWS_MAX)

  return (
    <div id={id} className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <p
          className={cn(
            'rounded-md border border-dashed px-4 py-4 text-center text-body text-muted-foreground',
            invalid ? 'border-destructive' : 'border-line',
          )}
        >
          {copy.rows.empty}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((row, index) => {
            const summary = summaryOf(row, subfields)
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond their position.
              <li key={index} className="rounded-md border border-line bg-card">
                <div className="flex items-center gap-1 border-b border-line py-1 pr-1 pl-3">
                  <span className="min-w-0 flex-1 truncate text-body-strong">
                    {copy.rows.row(index + 1)}
                    {summary ? (
                      <span className="font-normal text-muted-foreground"> · {summary}</span>
                    ) : null}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.rows.moveUp}
                    disabled={index === 0}
                    onClick={() => setRows(move(rows, index, index - 1))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.rows.moveDown}
                    disabled={index === rows.length - 1}
                    onClick={() => setRows(move(rows, index, index + 1))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.rows.remove}
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
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
              </li>
            )
          })}
        </ol>
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
