/**
 * Builds `packages/shipping/data/pincode-directory.json.gz` (PIN code → district and state)
 * from India Post's "All India Pincode Directory" CSV, published on data.gov.in under the
 * Government Open Data Licence - India (GODL-India). Download the CSV yourself from
 * https://www.data.gov.in/catalog/all-india-pincode-directory, check the licence shown on
 * that page, then run:
 *
 *   bun scripts/build-pincode-directory.ts path/to/all-india-pincode-directory.csv
 *
 * The CSV has one row per post office (about 155,000); the output keeps one row per PIN code
 * (about 19,000), roughly 60 KB gzipped. Keep the attribution in THIRD_PARTY_NOTICES.md
 * ("India PIN code directory") and docs/handoff/changes/2026-10-26-pincode-directory.md in
 * step with the release you used.
 */
import { gzipSync } from 'node:zlib'
import { stateMatchesPincode } from '../packages/core/src/checkout/pincode-state'
import { stateCode } from '../packages/core/src/tax/states'
import { buildPincodeDirectory, type PincodeSourceRow } from '../packages/shipping/src/pincode'

const SOURCE =
  'All India Pincode Directory, Department of Posts, Ministry of Communications, Government of India, via data.gov.in, under the Government Open Data Licence - India'

/** Spellings India Post uses that differ from our state names. */
const STATE_ALIASES: Record<string, string> = {
  'andaman & nicobar islands': 'AN',
  'andaman and nicobar': 'AN',
  'andaman and nico.in.': 'AN',
  chattisgarh: 'CG',
  'dadra & nagar haveli': 'DN',
  'dadra and nagar haveli': 'DN',
  'dadra and nagar hav.': 'DN',
  'daman & diu': 'DN',
  'daman and diu': 'DN',
  'the dadra and nagar haveli and daman and diu': 'DN',
  'jammu & kashmir': 'JK',
  megalaya: 'ML',
  orissa: 'OD',
  pondicherry: 'PY',
  uttaranchal: 'UK',
  delhi: 'DL',
  'nct of delhi': 'DL',
}

/**
 * Districts whose state the source gets wrong or out of date: Ladakh became its
 * own union territory in 2019 (older releases file Leh and Kargil under Jammu
 * and Kashmir), and Puducherry's enclaves are partly filed under the
 * neighbouring state's postal circle.
 */
const DISTRICT_STATE: Record<string, string> = {
  leh: 'LA',
  'leh ladakh': 'LA',
  kargil: 'LA',
  chandighar: 'CH',
  chandigarh: 'CH',
  pondicherry: 'PY',
  puducherry: 'PY',
  karaikal: 'PY',
  mahe: 'PY',
  yanam: 'PY',
}

/** Districts renamed by their state since the release (official current names). */
const DISTRICT_RENAMES: Record<string, string> = {
  allahabad: 'Prayagraj',
  'prayagraj allahabad': 'Prayagraj',
  bangalore: 'Bengaluru',
  belgaum: 'Belagavi',
  'bijapur(cgh)': 'Bijapur',
  'bijapur(kar)': 'Vijayapura',
  chandighar: 'Chandigarh',
  faizabad: 'Ayodhya',
  gulbarga: 'Kalaburagi',
  gurgaon: 'Gurugram',
  mewat: 'Nuh',
  mysore: 'Mysuru',
  'raigarh(mh)': 'Raigad',
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
const circle = header.findIndex((h) => h === 'circlename' || h === 'circle name')

/*
 * The state column is noisy: a few offices in most districts carry another
 * state's name (Panvel offices filed under Uttar Pradesh, Chandigarh's under
 * Punjab). A district lies in one state, so every office takes the state most
 * of its district's offices give. Districts are told apart by postal circle
 * too, since names repeat across states (Aurangabad, Bilaspur, Hamirpur).
 */
type Office = { pincode: string; district: string; state: string | null; districtKey: string }
const offices: Office[] = []
const votes = new Map<string, Map<string, number>>()
for (const r of rows) {
  if (r.length <= Math.max(pin, district, state)) continue
  // Some names carry stray bytes from the source's encoding (a replacement character after "Agartala").
  const name = (r[district] ?? '').replace(/[^\p{L}\p{N} .()&'-]/gu, '')
  const key = name.trim().toLowerCase().replace(/\s+/g, ' ')
  const districtKey = `${key}\u0000${circle < 0 ? '' : (r[circle] ?? '').trim().toLowerCase()}`
  const pincode = r[pin] ?? ''
  const given = DISTRICT_STATE[key] ?? stateOf(r[state] ?? '')
  // A state the PIN prefix rules out is a typo in the row (707004 for 797004, Kohima).
  const code = given && stateMatchesPincode(pincode, given) ? given : null
  offices.push({
    pincode,
    district: DISTRICT_RENAMES[key] ?? name,
    state: code,
    districtKey,
  })
  if (!code) continue
  const perDistrict = votes.get(districtKey) ?? new Map<string, number>()
  perDistrict.set(code, (perDistrict.get(code) ?? 0) + 1)
  votes.set(districtKey, perDistrict)
}
const districtState = new Map(
  [...votes].map(([key, perDistrict]) => {
    const [best] = [...perDistrict].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    return [key, (best as [string, number])[0]] as const
  }),
)

function* sourceRows(): Generator<PincodeSourceRow> {
  for (const o of offices) {
    const code = districtState.get(o.districtKey) ?? o.state
    yield {
      pincode: o.pincode,
      district: o.district,
      state: code && stateMatchesPincode(o.pincode, code) ? code : '',
    }
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
