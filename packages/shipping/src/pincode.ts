/**
 * Indian PIN code validation. Pure - safe to import from tests, server
 * actions and the browser.
 */

/**
 * India Post PIN codes are exactly six digits and never begin with 0: the
 * leading digit is the postal region (1-8 for the eight regions, 9 reserved
 * for the Army Postal Service). Checking only `/^\d{6}$/` lets "000000" and
 * "012345" through, and both reach the courier API as a real lookup that
 * costs a request and comes back "not serviceable" - which the customer then
 * reads as "we don't deliver to you" rather than "you typed it wrong".
 */
const PINCODE_RE = /^[1-9]\d{5}$/

export type PincodeParseSuccess = {
  ok: true
  pincode: string
}

export type PincodeParseFailure = {
  ok: false
  /** Stable code for callers to branch on. */
  reason: 'missing' | 'not_six_digits' | 'leading_zero'
  /** Customer-facing wording. Deliberately free of jargon. */
  message: string
}

export type PincodeParseResult = PincodeParseSuccess | PincodeParseFailure

/**
 * Normalise and validate user input.
 *
 * Accepts the things customers actually type - spaces, a hyphen in the middle
 * ("110 001", "110-001") - because rejecting those reads as a broken form
 * rather than as a validation rule.
 */
export function parsePincode(input: unknown): PincodeParseResult {
  if (typeof input !== 'string') {
    return { ok: false, reason: 'missing', message: 'Enter your 6-digit PIN code.' }
  }

  const cleaned = input.replace(/[\s-]/g, '')
  if (cleaned.length === 0) {
    return { ok: false, reason: 'missing', message: 'Enter your 6-digit PIN code.' }
  }

  if (!/^\d{6}$/.test(cleaned)) {
    return {
      ok: false,
      reason: 'not_six_digits',
      message: 'A PIN code is 6 digits, like 110001.',
    }
  }

  if (!PINCODE_RE.test(cleaned)) {
    return {
      ok: false,
      reason: 'leading_zero',
      message: "That doesn't look like an Indian PIN code - none start with 0.",
    }
  }

  return { ok: true, pincode: cleaned }
}

/** Convenience predicate for settings validation and adapter guards. */
export function isValidPincode(input: unknown): input is string {
  return parsePincode(input).ok
}

/*
 * PIN code directory: PIN code → district and state, so checkout can fill in
 * city and state from the PIN code. The data is India Post's All India Pincode
 * Directory from data.gov.in (Government Open Data Licence - India), reduced by
 * `scripts/build-pincode-directory.ts` to one row per PIN code. This part is
 * pure; reading the file is `@commerce/shipping/pincode-directory`.
 */

/** File format, version 1: districts once, then `[pin, districtIndex, stateCode]` rows. */
export type PincodeDirectoryFile = {
  v: 1
  /** Attribution line, shown in THIRD_PARTY_NOTICES.md and kept with the data. */
  source: string
  districts: string[]
  rows: [number, number, string][]
}

export type PincodePlace = {
  /** District as India Post names it, in title case; checkout uses it as the city. */
  district: string
  /** Two-letter state code, as addresses carry it. */
  stateCode: string
}

export type PincodeDirectory = {
  source: string
  size: number
  lookup(pincode: string): PincodePlace | null
}

/** Validate a parsed directory file and index it. Throws on a malformed file. */
export function decodePincodeDirectory(raw: unknown): PincodeDirectory {
  const file = raw as Partial<PincodeDirectoryFile> | null
  if (file?.v !== 1 || !Array.isArray(file.districts) || !Array.isArray(file.rows)) {
    throw new Error('Not a version 1 PIN code directory')
  }
  const districts = file.districts
  const index = new Map<number, PincodePlace>()
  for (const row of file.rows) {
    const [pin, d, state] = row
    const district = districts[d]
    if (typeof pin !== 'number' || district === undefined || typeof state !== 'string') {
      throw new Error(`Malformed PIN code directory row ${JSON.stringify(row)}`)
    }
    index.set(pin, { district, stateCode: state })
  }
  return {
    source: typeof file.source === 'string' ? file.source : '',
    size: index.size,
    lookup(pincode) {
      const parsed = parsePincode(pincode)
      return parsed.ok ? (index.get(Number(parsed.pincode)) ?? null) : null
    },
  }
}

export type PincodeSourceRow = {
  pincode: string
  district: string
  /** State or union territory name as the source spells it. */
  state: string
}

/** "NEW DELHI" / "new delhi" → "New Delhi"; keeps short words like "and" lower case. */
function titleCasePlace(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s(-])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/ (And|Of|The) /g, (w) => w.toLowerCase())
}

/**
 * Reduce post-office rows to one district and state per PIN code. A PIN code
 * shared by offices in two districts keeps the district most of its offices
 * are in (ties: alphabetical, so the output is stable). Rows whose state
 * `stateCodeOf` does not recognise, or whose PIN code is invalid, are skipped
 * and counted.
 */
export function buildPincodeDirectory(
  rows: Iterable<PincodeSourceRow>,
  stateCodeOf: (state: string) => string | null,
  source: string,
): { file: PincodeDirectoryFile; skipped: number } {
  const counts = new Map<number, Map<string, number>>()
  let skipped = 0
  for (const row of rows) {
    const pin = parsePincode(row.pincode)
    const state = stateCodeOf(row.state)
    const district = titleCasePlace(row.district)
    if (!pin.ok || !state || !district) {
      skipped++
      continue
    }
    const key = `${district}\u0000${state}`
    const perPin = counts.get(Number(pin.pincode)) ?? new Map<string, number>()
    perPin.set(key, (perPin.get(key) ?? 0) + 1)
    counts.set(Number(pin.pincode), perPin)
  }
  const districts: string[] = []
  const districtIndex = new Map<string, number>()
  const out: [number, number, string][] = []
  for (const pin of [...counts.keys()].sort((a, b) => a - b)) {
    const perPin = counts.get(pin) as Map<string, number>
    const [best] = [...perPin.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const [district, state] = (best as [string, number])[0].split('\u0000') as [string, string]
    let d = districtIndex.get(district)
    if (d === undefined) {
      d = districts.length
      districts.push(district)
      districtIndex.set(district, d)
    }
    out.push([pin, d, state])
  }
  return { file: { v: 1, source, districts, rows: out }, skipped }
}
