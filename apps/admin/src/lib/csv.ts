/** Minimal CSV writing for report exports; no dependency, RFC-4180 quoting. */

type Cell = string | number | Date | null | undefined

/**
 * One cell. Text starting with `=`, `+`, `-`, `@`, tab or CR gets an apostrophe so a
 * spreadsheet shows it instead of running it as a formula (report columns carry shopper
 * text such as UTM values and cities). Numbers are left alone, so `-2` stays a number.
 */
function cell(value: Cell): string {
  if (value === null || value === undefined) return ''
  let text = value instanceof Date ? value.toISOString() : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n')
}

/** Hands the browser a file without a round trip to the server. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
