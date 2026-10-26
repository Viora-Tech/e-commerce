import { INDIAN_STATE_NAMES } from './states'

/**
 * GST's own numeric state codes, printed beside "Place of supply" on an invoice
 * (CGST Rules, rule 46(n): "name of the State and its code"). Keyed by the
 * two-letter codes addresses carry.
 */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  JK: '01',
  HP: '02',
  PB: '03',
  CH: '04',
  UK: '05',
  HR: '06',
  DL: '07',
  RJ: '08',
  UP: '09',
  BR: '10',
  SK: '11',
  AR: '12',
  NL: '13',
  MN: '14',
  MZ: '15',
  TR: '16',
  ML: '17',
  AS: '18',
  WB: '19',
  JH: '20',
  OD: '21',
  CG: '22',
  MP: '23',
  GJ: '24',
  DN: '26',
  MH: '27',
  KA: '29',
  GA: '30',
  LD: '31',
  KL: '32',
  TN: '33',
  PY: '34',
  AN: '35',
  TS: '36',
  AP: '37',
  LA: '38',
}

const BY_GST_CODE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(GST_STATE_CODES).map(([letters, digits]) => [digits, letters]),
)

/** `{ code: 'HR', gstCode: '06', name: 'Haryana' }`, or null for an unknown state. */
export function gstState(
  stateCode: string | null | undefined,
): { code: string; gstCode: string; name: string } | null {
  const code = stateCode?.trim().toUpperCase()
  if (!code) return null
  const gstCode = GST_STATE_CODES[code]
  const name = INDIAN_STATE_NAMES[code]
  return gstCode && name ? { code, gstCode, name } : null
}

const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * The 15th character of a GSTIN: a base-36 Luhn-style check over the first 14,
 * weights alternating 1 and 2, each product folded as quotient plus remainder.
 */
export function gstinCheckChar(first14: string): string {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14.charAt(i))
    const product = value * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(product / 36) + (product % 36)
  }
  return CHARSET.charAt((36 - (sum % 36)) % 36)
}

/** What to tell someone whose GSTIN fails `validateGstin`, by its reason. */
export const GSTIN_MESSAGES = {
  shape: 'A GSTIN has 15 characters, like 06AAACW1234A1Z5',
  state: 'The first two digits are not a GST state code',
  checksum: 'This GSTIN has a typo: its last character does not match the rest',
} as const

export type GstinCheck = { ok: true; gstin: string } | { ok: false; reason: string }

/** Shape, state code and checksum. A typo in any character fails the checksum. */
export function validateGstin(raw: string | null | undefined): GstinCheck {
  const gstin = (raw ?? '').trim().toUpperCase()
  if (!SHAPE.test(gstin)) return { ok: false, reason: 'shape' }
  if (!BY_GST_CODE[gstin.slice(0, 2)]) return { ok: false, reason: 'state' }
  if (gstinCheckChar(gstin.slice(0, 14)) !== gstin.charAt(14)) {
    return { ok: false, reason: 'checksum' }
  }
  return { ok: true, gstin }
}

/** Characters 3 to 12 of a GSTIN are the holder's PAN. */
export function panFromGstin(gstin: string): string {
  return gstin.slice(2, 12)
}

/** Two-letter state a GSTIN is registered in, from its leading digits. */
export function gstinState(gstin: string): string | null {
  return BY_GST_CODE[gstin.slice(0, 2)] ?? null
}
