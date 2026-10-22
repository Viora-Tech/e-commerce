import type { CustomerSheetRow } from '@commerce/api'
import { PINCODE_PATTERN } from '@commerce/core/account-patterns'
import { validateGstin } from '@commerce/core/gstin'
import type { ConsentChannel } from '@commerce/core/privacy'
import { INDIAN_STATE_NAMES } from '@commerce/core/states'
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
  gstin: string
  businessName: string
  /** The default address's city, state code and PIN code; blank when there is none. */
  city: string
  stateCode: string
  pincode: string
  /** The whole default address the address cells edit; null makes them read-only. */
  address: CustomerSheetRow['defaultAddress']
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
  'gstin',
  'businessName',
  'city',
  'stateCode',
  'pincode',
] as const

/** Cells saved by `customers.update`. */
export const DETAIL_KEYS = ['name', 'phone', 'tags', 'note', 'gstin', 'businessName'] as const

/** Cells of the default address, saved by `customers.updateAddress`. */
export const ADDRESS_KEYS = ['city', 'stateCode', 'pincode'] as const
export const isAddressKey = (key: string) => (ADDRESS_KEYS as readonly string[]).includes(key)

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
    gstin: r.gstin,
    businessName: r.businessName,
    city: r.defaultAddress?.city ?? '',
    stateCode: r.defaultAddress?.stateCode ?? '',
    pincode: r.defaultAddress?.pincode ?? '',
    address: r.defaultAddress,
    anonymised: r.anonymised,
  }
}

/** "hr" or "Haryana" reads as HR, like the server's state check; null when it is neither. */
export function stateCodeOf(value: string): string | null {
  const v = value.trim()
  if (v.toUpperCase() in INDIAN_STATE_NAMES) return v.toUpperCase()
  const named = Object.entries(INDIAN_STATE_NAMES).find(
    ([, name]) => name.toLowerCase() === v.toLowerCase(),
  )
  return named?.[0] ?? null
}

/** The `validateGstin` reason a typed GSTIN fails on; null when blank or valid. */
export function gstinReason(value: string): 'shape' | 'state' | 'checksum' | null {
  if (value.trim() === '') return null
  const check = validateGstin(value)
  return check.ok ? null : ((check.reason as 'shape' | 'state' | 'checksum') ?? 'shape')
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

/** Erased customers are a record: nothing about them changes. No default address, no address cells. */
export const canEdit = (row: GridRow, key: string) =>
  (EDITABLE_KEYS as readonly string[]).includes(key) &&
  !row.anonymised &&
  !(isAddressKey(key) && row.address === null)

export const cellValue = (row: GridRow, key: string): string =>
  String((row as Record<string, unknown>)[key] ?? '')

export const withCell = (row: GridRow, key: string, value: string): GridRow => ({
  ...row,
  [key]: value,
})

/** GSTINs and state codes are stored upper case, so "hr" over "HR" is no change. */
const UPPER_KEYS = new Set(['gstin', 'stateCode'])

const comparable = (row: GridRow, key: string) => {
  if (key === 'tags') return parseTags(row.tags).join('\n')
  const v = cellValue(row, key).trim()
  return UPPER_KEYS.has(key) ? v.toUpperCase() : v
}

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
    const gstin = isDirty(r, b, 'gstin') ? gstinReason(r.gstin) : null
    if (gstin) bad('gstin', copy.gstin[gstin])
    if (isDirty(r, b, 'businessName') && r.businessName.trim().length > 120) {
      bad('businessName', copy.businessName)
    }
    // An address is resaved whole, so its cells are checked like the address form's.
    if (r.address && ADDRESS_KEYS.some((k) => isDirty(r, b, k))) {
      const city = r.city.trim()
      if (city.length === 0 || city.length > 80) bad('city', copy.city)
      if (!stateCodeOf(r.stateCode)) bad('stateCode', copy.stateCode)
      if (!PINCODE_PATTERN.test(r.pincode.trim())) bad('pincode', copy.pincode)
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
    ...(changed('gstin') ? { gstin: row.gstin.trim().toUpperCase() || null } : {}),
    ...(changed('businessName') ? { businessName: row.businessName.trim() || null } : {}),
  }
}

/** What `customers.updateAddress` takes for a changed default address; null when unchanged. */
export function addressPayload(row: GridRow, base: GridRow) {
  const a = row.address
  if (!a || !ADDRESS_KEYS.some((k) => isDirty(row, base, k))) return null
  return {
    customerId: row.id,
    addressId: a.id,
    address: {
      name: a.name,
      line1: a.line1,
      ...(a.line2 ? { line2: a.line2 } : {}),
      city: row.city.trim(),
      stateCode: stateCodeOf(row.stateCode) ?? row.stateCode.trim(),
      pincode: row.pincode.trim(),
      phone: a.phone,
    },
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
