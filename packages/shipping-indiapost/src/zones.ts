/**
 * Which India Post zone a parcel travels in, and how long India Post says that takes. Pure.
 *
 * Five zones. Four are India Post's own tariff columns (Local, Within State, Zone / Metro, Other
 * States); the fifth, `special`, is ours: the North East, Jammu & Kashmir, Ladakh and the islands
 * pay the Other States tariff (India Post has no surcharge for them) but take longer, so they get
 * their own transit row.
 *
 * Transit days are India Post's "Service Standards for Delivery (From Booking To Delivery)" on
 * the Speed Post Parcel page (read 2026-10-20): Local 1-2, Metro-Metro 1-3, Same State 1-4, Rest
 * of the Country 4-5, and one more day when a Branch Office delivers. Branch Office delivery is not
 * known before booking, so every maximum here already includes that day. `special` has no
 * published standard; 4-7 days is our own conservative figure, rest of the country plus two.
 *
 * How the zone is decided, from what is known about the two PIN codes (`PinPlace`):
 *  - local: the same PIN code; or both in the same metro city; or the same district.
 *  - metro: both in metro cities (different ones).
 *  - withinState: the same state.
 *  - special / otherStates: everything else, by the destination.
 * India Post's own "Local" is a municipality or, in a metro, a list of identified PIN codes; the
 * directory has neither, so district (and the metro's three-digit PIN area) stands in for it. A
 * merchant who sees a different column on their receipt can override the rate card.
 */

export type IndiaPostZone = 'local' | 'withinState' | 'metro' | 'otherStates' | 'special'

/** What the PIN code directory says about a PIN code, when it says anything. */
export type PinPlace = {
  pincode: string
  /** Post office names served by this PIN code, delivery offices first; empty when unknown. */
  offices: string[]
  district: string | null
  /**
   * State as the source names it: a two-letter code from the bundled directory, an upper-cased
   * name from data.gov.in. Only compared with a state from the same source.
   */
  state: string | null
  source: 'data.gov.in' | 'directory' | 'prefix'
}

/**
 * The six metro cities by their three-digit PIN area (India Post's metro mail networks: Delhi,
 * Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad). The first three digits of a PIN code are its
 * sorting district, published by India Post ("Postal Index Number", indiapost.gov.in).
 */
const METRO_AREAS: Readonly<Record<string, string>> = {
  '110': 'Delhi',
  '400': 'Mumbai',
  '700': 'Kolkata',
  '600': 'Chennai',
  '560': 'Bengaluru',
  '500': 'Hyderabad',
}

/** States and territories that get the `special` transit row, as codes and as data.gov.in names. */
const SPECIAL_STATES = new Set([
  'JK',
  'LA',
  'AS',
  'AR',
  'ML',
  'MN',
  'MZ',
  'NL',
  'TR',
  'SK',
  'AN',
  'LD',
  'JAMMU AND KASHMIR',
  'LADAKH',
  'ASSAM',
  'ARUNACHAL PRADESH',
  'MEGHALAYA',
  'MANIPUR',
  'MIZORAM',
  'NAGALAND',
  'TRIPURA',
  'SIKKIM',
  'ANDAMAN AND NICOBAR ISLANDS',
  'LAKSHADWEEP',
])

/**
 * The same regions by PIN code, when no directory says the state: 18 and 19 are Jammu & Kashmir
 * and Ladakh, 78 and 79 the North East, 737 Sikkim, 744 the Andaman & Nicobar Islands, 68255
 * Lakshadweep (India Post's PIN code allocation).
 */
const SPECIAL_PREFIXES = ['18', '19', '78', '79', '737', '744', '68255']

export const TRANSIT_DAYS: Readonly<Record<IndiaPostZone, { min: number; max: number }>> = {
  local: { min: 1, max: 3 },
  metro: { min: 1, max: 4 },
  withinState: { min: 1, max: 5 },
  otherStates: { min: 4, max: 6 },
  special: { min: 4, max: 7 },
}

const normState = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .replace(/\s*&\s*/g, ' AND ')

function metroOf(pincode: string): string | null {
  return METRO_AREAS[pincode.slice(0, 3)] ?? null
}

function isSpecialRegion(place: PinPlace): boolean {
  if (place.state) return SPECIAL_STATES.has(normState(place.state))
  return SPECIAL_PREFIXES.some((p) => place.pincode.startsWith(p))
}

/** The zone a parcel from `origin` to `destination` is charged and timed in. */
export function zoneFor(origin: PinPlace, destination: PinPlace): IndiaPostZone {
  if (origin.pincode === destination.pincode) return 'local'
  const fromMetro = metroOf(origin.pincode)
  const toMetro = metroOf(destination.pincode)
  if (fromMetro && fromMetro === toMetro) return 'local'
  const sameSource = origin.source === destination.source && origin.source !== 'prefix'
  if (
    sameSource &&
    origin.district &&
    origin.state &&
    origin.district === destination.district &&
    origin.state === destination.state
  )
    return 'local'
  if (fromMetro && toMetro) return 'metro'
  const sameState = sameSource
    ? Boolean(origin.state) && origin.state === destination.state
    : // Without a directory: the same first two digits is one postal circle's sorting region.
      origin.pincode.slice(0, 2) === destination.pincode.slice(0, 2)
  if (sameState) return 'withinState'
  return isSpecialRegion(destination) ? 'special' : 'otherStates'
}

/** India Post's tariff column for a zone: `special` pays Other States. */
export function tariffZoneOf(zone: IndiaPostZone): Exclude<IndiaPostZone, 'special'> {
  return zone === 'special' ? 'otherStates' : zone
}
