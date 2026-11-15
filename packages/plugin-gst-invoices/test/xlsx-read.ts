import { strFromU8, unzipSync } from 'fflate'

/** A cell as the test reads it: its value (number or text) and number format code, if any. */
export type ReadCell = { value: string | number; format: string | null; numeric: boolean }

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const BUILT_IN_FORMATS: Record<number, string> = { 0: 'General', 9: '0%', 10: '0.00%' }

function columnIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/**
 * Just enough of an .xlsx reader for the tests: sheet names in order, and each sheet as rows of
 * cells with their type and number format. Not for production use.
 */
export function readXlsx(bytes: Uint8Array): Map<string, (ReadCell | null)[][]> {
  const files = unzipSync(bytes)
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '')
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    decode([...(m[1] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  )
  const styles = text('xl/styles.xml')
  const numFmts = new Map<number, string>(
    [...styles.matchAll(/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g)].map((m) => [
      Number(m[1]),
      decode(m[2] ?? ''),
    ]),
  )
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)?.[1] ?? ''
  const xfFormats = [...cellXfs.matchAll(/<xf\b([^>]*)/g)].map((m) => {
    const id = Number(/numFmtId="(\d+)"/.exec(m[1] ?? '')?.[1] ?? 0)
    return numFmts.get(id) ?? BUILT_IN_FORMATS[id] ?? null
  })
  const rels = text('xl/_rels/workbook.xml.rels')
  const out = new Map<string, (ReadCell | null)[][]>()
  for (const m of text('xl/workbook.xml').matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = m[1] ?? ''
    const name = decode(/name="([^"]*)"/.exec(attrs)?.[1] ?? '')
    const rid = /r:id="([^"]*)"/.exec(attrs)?.[1] ?? ''
    const target =
      new RegExp(`Id="${rid}"[^>]*Target="([^"]*)"`).exec(rels)?.[1] ??
      new RegExp(`Target="([^"]*)"[^>]*Id="${rid}"`).exec(rels)?.[1] ??
      ''
    const xml = text(`xl/${target.replace(/^\/?xl\//, '')}`)
    const rows: (ReadCell | null)[][] = []
    for (const r of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const cells: (ReadCell | null)[] = []
      for (const c of (r[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = c[1] ?? ''
        const ref = /r="([A-Z]+\d+)"/.exec(a)?.[1] ?? 'A1'
        const t = /t="([^"]*)"/.exec(a)?.[1]
        const s = Number(/s="(\d+)"/.exec(a)?.[1] ?? 0)
        const body = c[2] ?? ''
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
        let cell: ReadCell | null = null
        if (t === 's' && v !== undefined)
          cell = { value: shared[Number(v)] ?? '', format: null, numeric: false }
        else if (t === 'inlineStr' || t === 'str')
          cell = {
            value: decode(/<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? v ?? ''),
            format: null,
            numeric: false,
          }
        else if (v !== undefined)
          cell = { value: Number(v), format: xfFormats[s] ?? null, numeric: true }
        cells[columnIndex(ref)] = cell
      }
      rows[Number(r[1]) - 1] = Array.from(cells, (x) => x ?? null)
    }
    out.set(
      name,
      Array.from(rows, (x) => x ?? []),
    )
  }
  return out
}

/** Row values only, for compact assertions. */
export const values = (row: (ReadCell | null)[] | undefined) =>
  (row ?? []).map((c) => c?.value ?? null)
