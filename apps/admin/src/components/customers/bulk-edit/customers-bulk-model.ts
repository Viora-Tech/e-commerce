import type { CustomerSheetRow } from '@commerce/api'
import type { ConsentChannel } from '@commerce/core/privacy'
import type { customersBulkEditContent } from '@/data/customers-bulk-edit'

type Copy = typeof customersBulkEditContent

/** One grid row: every cell is the text the person sees and types. */
export type GridRow = {
  id: string
  email: string
  name: string
  phone: string
  tags: string
  note: string
  /** 'yes' or 'no', one per consent channel. */
  acceptsMarketing: string
  acceptsWhatsapp: string
  acceptsSms: string
  anonymised: boolean
}

/** Editable column keys, in sheet order. */
export const EDITABLE_KEYS = [
  'name',
  'phone',
  'tags',
  'note',
  'acceptsMarketing',
  'acceptsWhatsapp',
  'acceptsSms',
] as const

/** Cells saved by `customers.update`. */
export const DETAIL_KEYS = ['name', 'phone', 'tags', 'note'] as const

/** Consent cells and the channel each one sets through `customerPrivacy.setConsent`. */
export const CONSENT_KEYS = {
  acceptsMarketing: 'email',
  acceptsWhatsapp: 'whatsapp',
  acceptsSms: 'sms',
} as const satisfies Record<string, ConsentChannel>
export type ConsentKey = keyof typeof CONSENT_KEYS

export const isConsentKey = (key: string): key is ConsentKey => key in CONSENT_KEYS

const yesNo = (v: boolean) => (v ? 'yes' : 'no')

export function toGridRow(r: CustomerSheetRow): GridRow {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    phone: r.phone,
    tags: r.tags.join(', '),
    note: r.note,
    acceptsMarketing: yesNo(r.acceptsMarketing),
    acceptsWhatsapp: yesNo(r.acceptsWhatsapp),
    acceptsSms: yesNo(r.acceptsSms),
    anonymised: r.anonymised,
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

/** Erased customers are a record: nothing about them changes. */
export const canEdit = (row: GridRow, key: string) =>
  (EDITABLE_KEYS as readonly string[]).includes(key) && !row.anonymised

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

/** `<customerId>|<column>`; a row-wide server failure uses the column `row`. */
export const errorKey = (customerId: string, column: string) => `${customerId}|${column}`
export type CellErrors = Map<string, string>

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
    if (isDirty(r, b, 'name') && r.name.trim().length > 200) bad('name', copy.name)
    if (isDirty(r, b, 'phone') && r.phone.trim().length > 30) bad('phone', copy.phone)
    if (isDirty(r, b, 'note') && r.note.trim().length > 2000) bad('note', copy.note)
    if (isDirty(r, b, 'tags')) {
      const tags = parseTags(r.tags)
      if (tags.length > 50) bad('tags', copy.tagCount)
      else if (tags.some((t) => t.length > 40)) bad('tags', copy.tagLength)
    }
  }
  return errors
}

/** What `customers.update` takes for this row's changed details (without the id). */
export function detailPayload(row: GridRow, base: GridRow) {
  const changed = (key: string) => isDirty(row, base, key)
  return {
    ...(changed('name') ? { name: row.name.trim() || null } : {}),
    ...(changed('phone') ? { phone: row.phone.trim() || null } : {}),
    ...(changed('tags') ? { tags: parseTags(row.tags) } : {}),
    ...(changed('note') ? { note: row.note.trim() || null } : {}),
  }
}

const YES = new Set(['yes', 'y', 'true', '1', 'subscribed'])
const NO = new Set(['no', 'n', 'false', '0', 'not subscribed', 'unsubscribed'])

/** A pasted consent cell is yes or no in a few spellings; anything else leaves it alone. */
function consentFromPaste(value: string, current: string) {
  const v = value.trim().toLowerCase()
  if (YES.has(v)) return 'yes'
  if (NO.has(v)) return 'no'
  return current
}

/** The keys of every column, for paste to count across. */
export const COLUMN_KEYS = ['email', ...EDITABLE_KEYS] as string[]

/** The columns shown: consent columns only for channels the store can send on. */
export const visibleKeys = (sendable: readonly ConsentChannel[]): string[] =>
  COLUMN_KEYS.filter((k) => !isConsentKey(k) || sendable.includes(CONSENT_KEYS[k]))

/**
 * A pasted block of tab-separated text (from Sheets or Excel) laid over the grid from the
 * active cell: down the rows and across the columns, skipping read-only cells.
 */
export function applyPaste(
  rows: GridRow[],
  start: { rowIdx: number; colIdx: number },
  pasted: string,
  keys: readonly string[] = COLUMN_KEYS,
): GridRow[] {
  const lines = pasted.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n')
  const next = [...rows]
  lines.forEach((line, dy) => {
    const target = next[start.rowIdx + dy]
    if (!target) return
    let row = target
    line.split('\t').forEach((value, dx) => {
      const key = keys[start.colIdx + dx]
      if (!key || !canEdit(row, key)) return
      const cell = isConsentKey(key) ? consentFromPaste(value, cellValue(row, key)) : value.trim()
      row = withCell(row, key, cell)
    })
    next[start.rowIdx + dy] = row
  })
  return next
}
