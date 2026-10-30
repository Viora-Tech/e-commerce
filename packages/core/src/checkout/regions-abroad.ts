/** SOURCE OF TRUTH: state and province codes abroad
 * WHAT:  The states of the US, Canada's provinces and territories and Australia's states, by
 *        their postal code, and the reading of a typed region into that code.
 * WHY:   Couriers abroad want the code, not the name: FedEx sends `stateOrProvinceCode` only as
 *        two letters, ShipGlobal's US services and DHL read it too. The checkout offers these
 *        as a list; a region typed elsewhere (imports, old forms) is matched to its code.
 * WHERE: Pure; `address-abroad.ts` checks and stores with it.
 */

const US: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  PR: 'Puerto Rico',
  AA: 'Armed Forces Americas',
  AE: 'Armed Forces Europe',
  AP: 'Armed Forces Pacific',
}

const CA: Record<string, string> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  ON: 'Ontario',
  PE: 'Prince Edward Island',
  QC: 'Quebec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
}

const AU: Record<string, string> = {
  ACT: 'Australian Capital Territory',
  NSW: 'New South Wales',
  NT: 'Northern Territory',
  QLD: 'Queensland',
  SA: 'South Australia',
  TAS: 'Tasmania',
  VIC: 'Victoria',
  WA: 'Western Australia',
}

const REGIONS: Record<string, Record<string, string>> = { US, CA, AU }

/** Folds "Québec", " new  york " to "quebec" / "new york" for matching. */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/[\s.]+/g, ' ')
    .toLowerCase()

/** `[code, name]` pairs for a country whose regions the checkout lists, by name; else null. */
export function regionList(countryCode: string): (readonly [string, string])[] | null {
  const table = REGIONS[countryCode]
  if (!table) return null
  return Object.entries(table).sort((a, b) => a[1].localeCompare(b[1]))
}

/**
 * "California", "ca", " New  York" → "CA" / "CA" / "NY" where the country's regions are
 * listed; null when the text is not one of them (or the country has no list).
 */
export function regionCodeOf(countryCode: string, raw: string): string | null {
  const table = REGIONS[countryCode]
  const text = fold(raw)
  if (!table || !text) return null
  const upper = text.toUpperCase().replace(/ /g, '')
  if (table[upper]) return upper
  const hit = Object.entries(table).find(([, name]) => fold(name) === text)
  return hit ? hit[0] : null
}

/** "CA" → "California" in the US; the code itself elsewhere. */
export const regionNameOf = (countryCode: string, code: string): string =>
  REGIONS[countryCode]?.[code] ?? code
