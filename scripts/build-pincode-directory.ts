/**
 * Builds `packages/shipping/data/pincode-directory.json.gz` (PIN code → district and state)
 * from India Post's "All India Pincode Directory" CSV, published on data.gov.in under the
 * Government Open Data Licence - India (GODL-India). Download the CSV yourself from
 * https://www.data.gov.in/catalog/all-india-pincode-directory, check the licence shown on
 * that page, then run:
 *
 *   bun scripts/build-pincode-directory.ts path/to/all-india-pincode-directory.csv
 *
 * The CSV has one row per post office (about 165,000); the output keeps one row per PIN code
 * (about 19,000), roughly 100 KB gzipped. Keep the attribution in THIRD_PARTY_NOTICES.md
 * ("Pincode directory" row) in step with the release you used.
 */
import { gzipSync } from 'node:zlib'
import { stateCode } from '../packages/core/src/tax/states'
import { buildPincodeDirectory, type PincodeSourceRow } from '../packages/shipping/src/pincode'

const SOURCE =
  'All India Pincode Directory, Department of Posts, Ministry of Communications, Government of India, via data.gov.in, under the Government Open Data Licence - India'

/** Spellings India Post uses that differ from our state names. */
const STATE_ALIASES: Record<string, string> = {
  'andaman & nicobar islands': 'AN',
  'andaman and nicobar': 'AN',
  chattisgarh: 'CG',
  'dadra & nagar haveli': 'DN',
  'dadra and nagar haveli': 'DN',
  'daman & diu': 'DN',
  'daman and diu': 'DN',
  'the dadra and nagar haveli and daman and diu': 'DN',
  'jammu & kashmir': 'JK',
  orissa: 'OD',
  pondicherry: 'PY',
  uttaranchal: 'UK',
  delhi: 'DL',
  'nct of delhi': 'DL',
}

function stateOf(name: string): string | null {
  const clean = name.trim().toLowerCase().replace(/\s+/g, ' ')
  return STATE_ALIASES[clean] ?? stateCode(clean.replace(/ & /g, ' and '))
}

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF. */
function* csvRows(text: string): Generator<string[]> {
  let field = ''
  let row: string[] = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      yield row
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) {
    row.push(field)
    yield row
  }
}

const input = process.argv[2]
if (!input) throw new Error('Usage: bun scripts/build-pincode-directory.ts <directory.csv>')
const out = new URL('../packages/shipping/data/pincode-directory.json.gz', import.meta.url)

const rows = csvRows(await Bun.file(input).text())
const header = (rows.next().value ?? []).map((h) => h.trim().toLowerCase())
const col = (...names: string[]) => {
  const i = header.findIndex((h) => names.includes(h))
  if (i < 0) throw new Error(`CSV has no ${names[0]} column (found: ${header.join(', ')})`)
  return i
}
const pin = col('pincode')
const district = col('district', 'districtname')
const state = col('statename', 'state')

function* sourceRows(): Generator<PincodeSourceRow> {
  for (const r of rows) {
    if (r.length <= Math.max(pin, district, state)) continue
    yield { pincode: r[pin] ?? '', district: r[district] ?? '', state: r[state] ?? '' }
  }
}

const { file, skipped } = buildPincodeDirectory(sourceRows(), stateOf, SOURCE)
if (file.rows.length < 15000) {
  throw new Error(
    `only ${file.rows.length} PIN codes parsed (${skipped} rows skipped); format changed?`,
  )
}
await Bun.write(out, gzipSync(JSON.stringify(file), { level: 9 }))
console.log(
  `${file.rows.length} PIN codes, ${file.districts.length} districts, ${skipped} rows skipped → ${out.pathname}`,
)
