/** Shared reading helpers for Shopify's CSV exports. Pure. */
import { parseCsv } from '@commerce/core/catalog'

export type CsvRow = {
  /** 1-based line number in the file (the header is line 1). */
  line: number
  /** First non-empty value among these column names (case-insensitive). */
  get: (...columns: string[]) => string
  /** Every column whose lower-cased header passes the test, with its value. */
  matching: (test: (header: string) => boolean) => { header: string; value: string }[]
}

export type CsvTable = { headers: string[]; rows: CsvRow[] }

export function readTable(text: string): CsvTable {
  const raw = parseCsv(text)
  const headers = (raw[0] ?? []).map((h) => h.trim())
  const lower = headers.map((h) => h.toLowerCase())
  const rows = raw.slice(1).map((cells, i) => ({
    line: i + 2,
    get: (...columns: string[]) => {
      for (const column of columns) {
        const at = lower.indexOf(column.toLowerCase())
        const value = at === -1 ? '' : (cells[at] ?? '').trim()
        if (value) return value
      }
      return ''
    },
    matching: (test: (header: string) => boolean) =>
      lower.flatMap((h, at) =>
        test(h) ? [{ header: headers[at] ?? h, value: (cells[at] ?? '').trim() }] : [],
      ),
  }))
  return { headers, rows }
}

export function hasColumn(table: CsvTable, ...names: string[]): boolean {
  const lower = new Set(table.headers.map((h) => h.toLowerCase()))
  return names.some((n) => lower.has(n.toLowerCase()))
}

/** "1,299.00" → 129900. Null when blank or unreadable. */
export function paise(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

export function int(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n) : null
}

export function bool(value: string, fallback: boolean): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return fallback
  return ['true', 'yes', 'y', '1', 'active', 'subscribed'].includes(v)
}

export function tags(value: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of value.split(',')) {
    const tag = raw.trim().slice(0, 50)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

/** Shopify prefixes numeric ids in CSVs with an apostrophe so spreadsheets keep them as text. */
export function cleanId(value: string): string | null {
  const v = value.replace(/^'+/, '').trim()
  return v || null
}

const GRAMS_PER: Record<string, number> = { g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125 }

export function toGrams(weight: string, unit: string): number | null {
  const n = Number(weight.replace(/[^0-9.-]/g, ''))
  if (!weight.trim() || !Number.isFinite(n)) return null
  return Math.round(n * (GRAMS_PER[unit.trim().toLowerCase()] ?? 1))
}
