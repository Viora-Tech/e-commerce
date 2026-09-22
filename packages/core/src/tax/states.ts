/**
 * Indian states and union territories, by the two-letter code addresses carry.
 * GST only needs one thing from this list: whether two places are the same
 * state, so the table also answers to full names typed into Settings.
 */
export const INDIAN_STATE_NAMES: Readonly<Record<string, string>> = {
  AN: 'Andaman and Nicobar Islands',
  AP: 'Andhra Pradesh',
  AR: 'Arunachal Pradesh',
  AS: 'Assam',
  BR: 'Bihar',
  CG: 'Chhattisgarh',
  CH: 'Chandigarh',
  DL: 'Delhi',
  DN: 'Dadra and Nagar Haveli and Daman and Diu',
  GA: 'Goa',
  GJ: 'Gujarat',
  HP: 'Himachal Pradesh',
  HR: 'Haryana',
  JH: 'Jharkhand',
  JK: 'Jammu and Kashmir',
  KA: 'Karnataka',
  KL: 'Kerala',
  LA: 'Ladakh',
  LD: 'Lakshadweep',
  MH: 'Maharashtra',
  ML: 'Meghalaya',
  MN: 'Manipur',
  MP: 'Madhya Pradesh',
  MZ: 'Mizoram',
  NL: 'Nagaland',
  OD: 'Odisha',
  PB: 'Punjab',
  PY: 'Puducherry',
  RJ: 'Rajasthan',
  SK: 'Sikkim',
  TN: 'Tamil Nadu',
  TR: 'Tripura',
  TS: 'Telangana',
  UK: 'Uttarakhand',
  UP: 'Uttar Pradesh',
  WB: 'West Bengal',
}

const BY_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(INDIAN_STATE_NAMES).map(([code, name]) => [name.toLowerCase(), code]),
)

/**
 * Two-letter code for whatever a merchant or a checkout wrote: a code, a full
 * name, or something we do not recognise (returned as null so the caller can
 * fall back rather than guess a state and charge the wrong tax).
 */
export function stateCode(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  const upper = v.toUpperCase()
  if (INDIAN_STATE_NAMES[upper]) return upper
  return BY_NAME[v.toLowerCase()] ?? null
}

/** True when both places resolve to the same state; unknown on either side means "cannot tell". */
export function sameState(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = stateCode(a)
  const right = stateCode(b)
  return left !== null && left === right
}
