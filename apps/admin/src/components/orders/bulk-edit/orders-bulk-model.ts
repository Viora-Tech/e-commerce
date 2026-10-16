import type { OrderSheetRow } from '@commerce/api'
import { z } from 'zod'
import { INDIAN_STATES } from '@/data/india'
import type { ordersBulkEditContent } from '@/data/orders-bulk-edit'

type Copy = typeof ordersBulkEditContent

export const MARKS = ['paid', 'fulfilled', 'delivered', 'cancelled'] as const
export type Mark = (typeof MARKS)[number]

/** One grid row: every cell is the text the person sees and types. */
export type GridRow = {
  id: string
  number: string
  placed: string
  name: string
  email: string
  phone: string
  line1: string
  line2: string
  city: string
  stateCode: string
  pincode: string
  tags: string
  /** '' (leave alone) or a `Mark`. */
  mark: string
  imported: boolean
}

/** Editable column keys, in sheet order. */
export const EDITABLE_KEYS = [
  'name',
  'email',
  'phone',
  'line1',
  'line2',
  'city',
  'stateCode',
  'pincode',
  'tags',
  'mark',
] as const

/** Cells saved by `orders.updateContact`, `orders.setTags` and `orders.setStatus`. */
export const CONTACT_KEYS = [
  'name',
  'email',
  'phone',
  'line1',
  'line2',
  'city',
  'stateCode',
  'pincode',
] as const

export function toGridRow(r: OrderSheetRow): GridRow {
  return {
    id: r.id,
    number: String(r.number),
    placed: new Date(r.placedAt).toISOString(),
    name: r.name,
    email: r.email,
    phone: r.phone,
    line1: r.address?.line1 ?? '',
    line2: r.address?.line2 ?? '',
    city: r.address?.city ?? '',
    stateCode: r.address?.stateCode ?? '',
    pincode: r.address?.pincode ?? '',
    tags: r.tags.join(', '),
    mark: '',
    imported: r.imported,
  }
}

/** "a, b ,,a" becomes ["a", "b"]: trimmed, no blanks, no repeats. */
export const parseTags = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  ),
]

/** Imported orders are a record: only their tags may change. */
export const canEdit = (row: GridRow, key: string) =>
  (EDITABLE_KEYS as readonly string[]).includes(key) && (!row.imported || key === 'tags')

export const cellValue = (row: GridRow, key: string): string =>
  String((row as Record<string, unknown>)[key] ?? '')

export const withCell = (row: GridRow, key: string, value: string): GridRow => ({
  ...row,
  [key]: value,
})

const comparable = (row: GridRow, key: string) =>
  key === 'tags' ? parseTags(row.tags).join('\n') : cellValue(row, key).trim()

export const isDirty = (row: GridRow, base: GridRow | undefined, key: string) =>
  base !== undefined && comparable(row, key) !== comparable(base, key)

/** Cells that differ from the loaded sheet, across all rows. */
export function dirtyCount(rows: GridRow[], base: Map<string, GridRow>): number {
  let n = 0
  for (const row of rows)
    for (const k of EDITABLE_KEYS) if (isDirty(row, base.get(row.id), k)) n += 1
  return n
}

/** `<orderId>|<column>`; a row-wide server failure uses the column `row`. */
export const errorKey = (orderId: string, column: string) => `${orderId}|${column}`
export type CellErrors = Map<string, string>

const emailSchema = z.email().max(200)

/** The rules the server also enforces, on changed cells only, so old data never blocks a save. */
export function validateRows(
  rows: GridRow[],
  base: Map<string, GridRow>,
  copy: Copy['validation'],
): CellErrors {
  const errors: CellErrors = new Map()
  for (const r of rows) {
    const b = base.get(r.id)
    const bad = (column: string, message: string) => errors.set(errorKey(r.id, column), message)
    if (isDirty(r, b, 'name') && r.name.trim().length > 120) bad('name', copy.name)
    if (isDirty(r, b, 'email') && r.email.trim() && !emailSchema.safeParse(r.email.trim()).success)
      bad('email', copy.email)
    if (isDirty(r, b, 'phone') && r.phone.trim().length > 30) bad('phone', copy.phone)
    if (isDirty(r, b, 'pincode') && r.pincode.trim() && !/^\d{6}$/.test(r.pincode.trim()))
      bad('pincode', copy.pincode)
    if (isDirty(r, b, 'tags')) {
      const tags = parseTags(r.tags)
      if (tags.length > 20) bad('tags', copy.tagCount)
      else if (tags.some((t) => t.length > 40)) bad('tags', copy.tagLength)
    }
  }
  return errors
}

/** What `orders.updateContact` takes for this row (without the order id). */
export function contactPayload(row: GridRow) {
  const parts = [row.line1, row.line2, row.city, row.stateCode, row.pincode].map((v) => v.trim())
  const empty = parts.every((v) => v === '')
  return {
    name: row.name.trim(),
    email: row.email.trim() || null,
    phone: row.phone.trim() || null,
    address: empty
      ? null
      : {
          line1: parts[0] ?? '',
          line2: parts[1] || null,
          city: parts[2] ?? '',
          stateCode: parts[3] ?? '',
          pincode: parts[4] ?? '',
        },
  }
}

/** A pasted state is the code or the name; anything else is kept for validation to see. */
function stateFromPaste(value: string) {
  const v = value.trim().toLowerCase()
  const hit = INDIAN_STATES.find((s) => s.code.toLowerCase() === v || s.name.toLowerCase() === v)
  return hit?.code ?? value.trim().toUpperCase()
}

/** The same, for the Mark as cell. */
function markFromPaste(value: string) {
  const v = value.trim().toLowerCase()
  return (MARKS as readonly string[]).includes(v) ? v : ''
}

export function pastedValue(key: string, value: string) {
  if (key === 'stateCode') return stateFromPaste(value)
  if (key === 'mark') return markFromPaste(value)
  return value.trim()
}

/** The keys of every column, for paste to count across. */
export const COLUMN_KEYS = ['number', 'placed', ...EDITABLE_KEYS] as string[]

/**
 * A pasted block of tab-separated text (from Sheets or Excel) laid over the grid from the
 * active cell: down the rows and across the columns, skipping read-only cells.
 */
export function applyPaste(
  rows: GridRow[],
  start: { rowIdx: number; colIdx: number },
  pasted: string,
): GridRow[] {
  const lines = pasted.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
  const next = [...rows]
  lines.forEach((line, dy) => {
    const target = next[start.rowIdx + dy]
    if (!target) return
    let row = target
    line.split('\t').forEach((value, dx) => {
      const key = COLUMN_KEYS[start.colIdx + dx]
      if (key && canEdit(row, key)) row = withCell(row, key, pastedValue(key, value))
    })
    next[start.rowIdx + dy] = row
  })
  return next
}
