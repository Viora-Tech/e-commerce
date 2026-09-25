/**
 * Latitude/longitude for the home page's Live view globe: every Indian state/UT's capital
 * (or a geographic centroid for the few without one) plus about 150 major cities. Coordinates
 * are geographic facts, entered by hand from general knowledge (rounded to ~0.01 degrees,
 * plenty for a small WebGL globe) — not copied from any licensed pincode or geocoding dataset,
 * since we do not have a licence-checked one yet (see the home-globe PR).
 *
 * Resolution is done client-side (`resolveOrderLocation`, `resolveDispatchLocation`) rather than
 * in `packages/api`: this dataset lives in the admin app, and server code in `packages/api`
 * cannot import from an app. The server payload (order city + state code) stays small either
 * way; only the coordinates never leave the browser.
 */

export type GeoPoint = { lat: number; lng: number }

type StateCentroid = GeoPoint & { name: string }

/** Every state/UT's capital (a geographic centroid for the couple that have none), by the
 * two-letter code addresses carry (matches `packages/core/src/tax/states.ts`). */
export const STATE_CENTROIDS: Readonly<Record<string, StateCentroid>> = {
  AN: { name: 'Andaman and Nicobar Islands', lat: 11.62, lng: 92.73 }, // Port Blair
  AP: { name: 'Andhra Pradesh', lat: 16.51, lng: 80.65 }, // Amaravati
  AR: { name: 'Arunachal Pradesh', lat: 27.1, lng: 93.62 }, // Itanagar
  AS: { name: 'Assam', lat: 26.14, lng: 91.77 }, // Guwahati (seat of government)
  BR: { name: 'Bihar', lat: 25.6, lng: 85.12 }, // Patna
  CG: { name: 'Chhattisgarh', lat: 21.25, lng: 81.63 }, // Raipur
  CH: { name: 'Chandigarh', lat: 30.73, lng: 76.78 },
  DL: { name: 'Delhi', lat: 28.61, lng: 77.21 },
  DN: { name: 'Dadra and Nagar Haveli and Daman and Diu', lat: 20.27, lng: 73.02 }, // Daman
  GA: { name: 'Goa', lat: 15.49, lng: 73.83 }, // Panaji
  GJ: { name: 'Gujarat', lat: 23.22, lng: 72.68 }, // Gandhinagar
  HP: { name: 'Himachal Pradesh', lat: 31.1, lng: 77.17 }, // Shimla
  HR: { name: 'Haryana', lat: 30.74, lng: 76.78 }, // Chandigarh (shared)
  JH: { name: 'Jharkhand', lat: 23.34, lng: 85.31 }, // Ranchi
  JK: { name: 'Jammu and Kashmir', lat: 34.08, lng: 74.8 }, // Srinagar (summer capital)
  KA: { name: 'Karnataka', lat: 12.97, lng: 77.59 }, // Bengaluru
  KL: { name: 'Kerala', lat: 8.52, lng: 76.94 }, // Thiruvananthapuram
  LA: { name: 'Ladakh', lat: 34.15, lng: 77.58 }, // Leh
  LD: { name: 'Lakshadweep', lat: 10.57, lng: 72.64 }, // Kavaratti
  MH: { name: 'Maharashtra', lat: 19.08, lng: 72.88 }, // Mumbai
  ML: { name: 'Meghalaya', lat: 25.57, lng: 91.88 }, // Shillong
  MN: { name: 'Manipur', lat: 24.82, lng: 93.94 }, // Imphal
  MP: { name: 'Madhya Pradesh', lat: 23.26, lng: 77.41 }, // Bhopal
  MZ: { name: 'Mizoram', lat: 23.73, lng: 92.72 }, // Aizawl
  NL: { name: 'Nagaland', lat: 25.67, lng: 94.12 }, // Kohima
  OD: { name: 'Odisha', lat: 20.3, lng: 85.82 }, // Bhubaneswar
  PB: { name: 'Punjab', lat: 30.73, lng: 76.78 }, // Chandigarh (shared)
  PY: { name: 'Puducherry', lat: 11.94, lng: 79.83 },
  RJ: { name: 'Rajasthan', lat: 26.91, lng: 75.79 }, // Jaipur
  SK: { name: 'Sikkim', lat: 27.33, lng: 88.61 }, // Gangtok
  TN: { name: 'Tamil Nadu', lat: 13.08, lng: 80.27 }, // Chennai
  TR: { name: 'Tripura', lat: 23.83, lng: 91.28 }, // Agartala
  TS: { name: 'Telangana', lat: 17.39, lng: 78.49 }, // Hyderabad
  UK: { name: 'Uttarakhand', lat: 30.32, lng: 78.03 }, // Dehradun
  UP: { name: 'Uttar Pradesh', lat: 26.85, lng: 80.95 }, // Lucknow
  WB: { name: 'West Bengal', lat: 22.57, lng: 88.36 }, // Kolkata
}

type CityEntry = GeoPoint & { stateCode: string }

/** ~150 major cities, keyed by `normaliseCityName`. Not exhaustive; unmatched cities fall
 * back to their state's centroid (`resolveOrderLocation`). */
export const CITY_COORDS: Readonly<Record<string, CityEntry>> = {
  // Andhra Pradesh
  visakhapatnam: { lat: 17.69, lng: 83.22, stateCode: 'AP' },
  vijayawada: { lat: 16.51, lng: 80.65, stateCode: 'AP' },
  guntur: { lat: 16.3, lng: 80.44, stateCode: 'AP' },
  tirupati: { lat: 13.63, lng: 79.42, stateCode: 'AP' },
  nellore: { lat: 14.44, lng: 79.99, stateCode: 'AP' },
  kurnool: { lat: 15.83, lng: 78.04, stateCode: 'AP' },
  rajahmundry: { lat: 17.0, lng: 81.78, stateCode: 'AP' },
  kakinada: { lat: 16.99, lng: 82.25, stateCode: 'AP' },
  // Arunachal Pradesh
  itanagar: { lat: 27.1, lng: 93.62, stateCode: 'AR' },
  // Assam
  guwahati: { lat: 26.14, lng: 91.77, stateCode: 'AS' },
  dibrugarh: { lat: 27.48, lng: 94.91, stateCode: 'AS' },
  silchar: { lat: 24.83, lng: 92.78, stateCode: 'AS' },
  jorhat: { lat: 26.75, lng: 94.22, stateCode: 'AS' },
  tezpur: { lat: 26.63, lng: 92.8, stateCode: 'AS' },
  // Bihar
  patna: { lat: 25.6, lng: 85.12, stateCode: 'BR' },
  gaya: { lat: 24.8, lng: 85.0, stateCode: 'BR' },
  bhagalpur: { lat: 25.24, lng: 87.0, stateCode: 'BR' },
  muzaffarpur: { lat: 26.12, lng: 85.39, stateCode: 'BR' },
  darbhanga: { lat: 26.15, lng: 85.9, stateCode: 'BR' },
  // Chhattisgarh
  raipur: { lat: 21.25, lng: 81.63, stateCode: 'CG' },
  bhilai: { lat: 21.21, lng: 81.43, stateCode: 'CG' },
  bilaspur: { lat: 22.08, lng: 82.15, stateCode: 'CG' },
  korba: { lat: 22.35, lng: 82.68, stateCode: 'CG' },
  // Chandigarh / Delhi
  chandigarh: { lat: 30.73, lng: 76.78, stateCode: 'CH' },
  delhi: { lat: 28.61, lng: 77.21, stateCode: 'DL' },
  'new delhi': { lat: 28.61, lng: 77.21, stateCode: 'DL' },
  dwarka: { lat: 28.59, lng: 77.05, stateCode: 'DL' },
  // Goa
  panaji: { lat: 15.49, lng: 73.83, stateCode: 'GA' },
  margao: { lat: 15.27, lng: 73.96, stateCode: 'GA' },
  vasco: { lat: 15.4, lng: 73.81, stateCode: 'GA' },
  // Gujarat
  ahmedabad: { lat: 23.02, lng: 72.57, stateCode: 'GJ' },
  surat: { lat: 21.17, lng: 72.83, stateCode: 'GJ' },
  vadodara: { lat: 22.31, lng: 73.19, stateCode: 'GJ' },
  rajkot: { lat: 22.3, lng: 70.8, stateCode: 'GJ' },
  bhavnagar: { lat: 21.76, lng: 72.15, stateCode: 'GJ' },
  jamnagar: { lat: 22.47, lng: 70.07, stateCode: 'GJ' },
  gandhinagar: { lat: 23.22, lng: 72.68, stateCode: 'GJ' },
  anand: { lat: 22.56, lng: 72.96, stateCode: 'GJ' },
  // Haryana
  gurugram: { lat: 28.46, lng: 77.03, stateCode: 'HR' },
  gurgaon: { lat: 28.46, lng: 77.03, stateCode: 'HR' },
  faridabad: { lat: 28.41, lng: 77.32, stateCode: 'HR' },
  panipat: { lat: 29.39, lng: 76.97, stateCode: 'HR' },
  karnal: { lat: 29.68, lng: 76.99, stateCode: 'HR' },
  hisar: { lat: 29.15, lng: 75.72, stateCode: 'HR' },
  ambala: { lat: 30.38, lng: 76.78, stateCode: 'HR' },
  // Himachal Pradesh
  shimla: { lat: 31.1, lng: 77.17, stateCode: 'HP' },
  manali: { lat: 32.24, lng: 77.19, stateCode: 'HP' },
  dharamshala: { lat: 32.22, lng: 76.32, stateCode: 'HP' },
  // Jharkhand
  ranchi: { lat: 23.34, lng: 85.31, stateCode: 'JH' },
  jamshedpur: { lat: 22.8, lng: 86.18, stateCode: 'JH' },
  dhanbad: { lat: 23.8, lng: 86.44, stateCode: 'JH' },
  bokaro: { lat: 23.67, lng: 86.15, stateCode: 'JH' },
  // Jammu and Kashmir / Ladakh
  srinagar: { lat: 34.08, lng: 74.8, stateCode: 'JK' },
  jammu: { lat: 32.73, lng: 74.87, stateCode: 'JK' },
  leh: { lat: 34.15, lng: 77.58, stateCode: 'LA' },
  // Karnataka
  bengaluru: { lat: 12.97, lng: 77.59, stateCode: 'KA' },
  bangalore: { lat: 12.97, lng: 77.59, stateCode: 'KA' },
  mysuru: { lat: 12.3, lng: 76.64, stateCode: 'KA' },
  mysore: { lat: 12.3, lng: 76.64, stateCode: 'KA' },
  hubli: { lat: 15.36, lng: 75.12, stateCode: 'KA' },
  mangaluru: { lat: 12.87, lng: 74.84, stateCode: 'KA' },
  mangalore: { lat: 12.87, lng: 74.84, stateCode: 'KA' },
  belagavi: { lat: 15.85, lng: 74.5, stateCode: 'KA' },
  davanagere: { lat: 14.46, lng: 75.92, stateCode: 'KA' },
  // Kerala
  thiruvananthapuram: { lat: 8.52, lng: 76.94, stateCode: 'KL' },
  kochi: { lat: 9.93, lng: 76.27, stateCode: 'KL' },
  ernakulam: { lat: 9.98, lng: 76.28, stateCode: 'KL' },
  kozhikode: { lat: 11.26, lng: 75.78, stateCode: 'KL' },
  calicut: { lat: 11.26, lng: 75.78, stateCode: 'KL' },
  thrissur: { lat: 10.53, lng: 76.21, stateCode: 'KL' },
  kollam: { lat: 8.89, lng: 76.6, stateCode: 'KL' },
  kannur: { lat: 11.87, lng: 75.36, stateCode: 'KL' },
  // Madhya Pradesh
  bhopal: { lat: 23.26, lng: 77.41, stateCode: 'MP' },
  indore: { lat: 22.72, lng: 75.86, stateCode: 'MP' },
  gwalior: { lat: 26.22, lng: 78.18, stateCode: 'MP' },
  jabalpur: { lat: 23.18, lng: 79.99, stateCode: 'MP' },
  ujjain: { lat: 23.18, lng: 75.78, stateCode: 'MP' },
  // Maharashtra
  mumbai: { lat: 19.08, lng: 72.88, stateCode: 'MH' },
  pune: { lat: 18.52, lng: 73.86, stateCode: 'MH' },
  nagpur: { lat: 21.15, lng: 79.09, stateCode: 'MH' },
  nashik: { lat: 20.0, lng: 73.79, stateCode: 'MH' },
  thane: { lat: 19.22, lng: 72.98, stateCode: 'MH' },
  aurangabad: { lat: 19.88, lng: 75.34, stateCode: 'MH' },
  'chhatrapati sambhajinagar': { lat: 19.88, lng: 75.34, stateCode: 'MH' },
  solapur: { lat: 17.66, lng: 75.91, stateCode: 'MH' },
  kolhapur: { lat: 16.7, lng: 74.24, stateCode: 'MH' },
  'navi mumbai': { lat: 19.03, lng: 73.02, stateCode: 'MH' },
  // Manipur / Meghalaya / Mizoram / Nagaland
  imphal: { lat: 24.82, lng: 93.94, stateCode: 'MN' },
  shillong: { lat: 25.57, lng: 91.88, stateCode: 'ML' },
  aizawl: { lat: 23.73, lng: 92.72, stateCode: 'MZ' },
  kohima: { lat: 25.67, lng: 94.12, stateCode: 'NL' },
  dimapur: { lat: 25.91, lng: 93.73, stateCode: 'NL' },
  // Odisha
  bhubaneswar: { lat: 20.3, lng: 85.82, stateCode: 'OD' },
  cuttack: { lat: 20.47, lng: 85.88, stateCode: 'OD' },
  rourkela: { lat: 22.25, lng: 84.85, stateCode: 'OD' },
  puri: { lat: 19.8, lng: 85.83, stateCode: 'OD' },
  // Puducherry
  puducherry: { lat: 11.94, lng: 79.83, stateCode: 'PY' },
  // Punjab
  ludhiana: { lat: 30.9, lng: 75.86, stateCode: 'PB' },
  amritsar: { lat: 31.63, lng: 74.87, stateCode: 'PB' },
  jalandhar: { lat: 31.33, lng: 75.58, stateCode: 'PB' },
  patiala: { lat: 30.34, lng: 76.39, stateCode: 'PB' },
  mohali: { lat: 30.7, lng: 76.72, stateCode: 'PB' },
  bathinda: { lat: 30.21, lng: 74.95, stateCode: 'PB' },
  // Rajasthan
  jaipur: { lat: 26.91, lng: 75.79, stateCode: 'RJ' },
  jodhpur: { lat: 26.24, lng: 73.02, stateCode: 'RJ' },
  udaipur: { lat: 24.58, lng: 73.68, stateCode: 'RJ' },
  kota: { lat: 25.21, lng: 75.86, stateCode: 'RJ' },
  ajmer: { lat: 26.45, lng: 74.64, stateCode: 'RJ' },
  bikaner: { lat: 28.02, lng: 73.31, stateCode: 'RJ' },
  // Sikkim
  gangtok: { lat: 27.33, lng: 88.61, stateCode: 'SK' },
  // Tamil Nadu
  chennai: { lat: 13.08, lng: 80.27, stateCode: 'TN' },
  coimbatore: { lat: 11.02, lng: 76.96, stateCode: 'TN' },
  madurai: { lat: 9.93, lng: 78.12, stateCode: 'TN' },
  tiruchirappalli: { lat: 10.79, lng: 78.7, stateCode: 'TN' },
  trichy: { lat: 10.79, lng: 78.7, stateCode: 'TN' },
  salem: { lat: 11.66, lng: 78.15, stateCode: 'TN' },
  tirunelveli: { lat: 8.71, lng: 77.76, stateCode: 'TN' },
  erode: { lat: 11.34, lng: 77.72, stateCode: 'TN' },
  vellore: { lat: 12.92, lng: 79.13, stateCode: 'TN' },
  // Telangana
  hyderabad: { lat: 17.39, lng: 78.49, stateCode: 'TS' },
  warangal: { lat: 17.98, lng: 79.6, stateCode: 'TS' },
  nizamabad: { lat: 18.67, lng: 78.09, stateCode: 'TS' },
  secunderabad: { lat: 17.44, lng: 78.5, stateCode: 'TS' },
  // Tripura
  agartala: { lat: 23.83, lng: 91.28, stateCode: 'TR' },
  // Uttar Pradesh
  lucknow: { lat: 26.85, lng: 80.95, stateCode: 'UP' },
  kanpur: { lat: 26.45, lng: 80.33, stateCode: 'UP' },
  ghaziabad: { lat: 28.67, lng: 77.42, stateCode: 'UP' },
  agra: { lat: 27.18, lng: 78.02, stateCode: 'UP' },
  meerut: { lat: 28.98, lng: 77.71, stateCode: 'UP' },
  varanasi: { lat: 25.32, lng: 82.99, stateCode: 'UP' },
  prayagraj: { lat: 25.44, lng: 81.85, stateCode: 'UP' },
  allahabad: { lat: 25.44, lng: 81.85, stateCode: 'UP' },
  noida: { lat: 28.54, lng: 77.39, stateCode: 'UP' },
  bareilly: { lat: 28.35, lng: 79.42, stateCode: 'UP' },
  aligarh: { lat: 27.88, lng: 78.08, stateCode: 'UP' },
  moradabad: { lat: 28.84, lng: 78.78, stateCode: 'UP' },
  gorakhpur: { lat: 26.76, lng: 83.37, stateCode: 'UP' },
  jhansi: { lat: 25.45, lng: 78.57, stateCode: 'UP' },
  // Uttarakhand
  dehradun: { lat: 30.32, lng: 78.03, stateCode: 'UK' },
  haridwar: { lat: 29.95, lng: 78.16, stateCode: 'UK' },
  nainital: { lat: 29.38, lng: 79.46, stateCode: 'UK' },
  rishikesh: { lat: 30.09, lng: 78.27, stateCode: 'UK' },
  // West Bengal
  kolkata: { lat: 22.57, lng: 88.36, stateCode: 'WB' },
  howrah: { lat: 22.59, lng: 88.31, stateCode: 'WB' },
  durgapur: { lat: 23.52, lng: 87.31, stateCode: 'WB' },
  siliguri: { lat: 26.73, lng: 88.39, stateCode: 'WB' },
  asansol: { lat: 23.68, lng: 86.99, stateCode: 'WB' },
  // Andaman and Nicobar / Lakshadweep / Dadra and Nagar Haveli and Daman and Diu
  'port blair': { lat: 11.62, lng: 92.73, stateCode: 'AN' },
  kavaratti: { lat: 10.57, lng: 72.64, stateCode: 'LD' },
  daman: { lat: 20.27, lng: 73.02, stateCode: 'DN' },
  silvassa: { lat: 20.28, lng: 73.02, stateCode: 'DN' },
}

/** Lowercase, trimmed, whitespace-collapsed; drops a trailing "city"/"dist"/"district" so
 * "Bengaluru City" and "Bengaluru" resolve the same way. */
export function normaliseCityName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\((rural|urban)\)\s*$/, '')
    .replace(/\s+(city|dist\.?|district)$/, '')
}

const STATE_BY_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(STATE_CENTROIDS).map(([code, s]) => [s.name.toLowerCase(), code]),
)

/** A free-text state name or a two-letter code -> the code, or null if neither matches. */
export function resolveStateCode(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  const upper = v.toUpperCase()
  if (STATE_CENTROIDS[upper]) return upper
  return STATE_BY_NAME[v.toLowerCase()] ?? null
}

export type ResolvedLocation = GeoPoint & { source: 'city' | 'state' }

/** A buyer's shipping city + state code -> a map point: the city's coordinates when we know
 * it, otherwise the state's centroid. Null only when the state code itself is unknown. */
export function resolveOrderLocation(city: string, stateCode: string): ResolvedLocation | null {
  const cityHit = CITY_COORDS[normaliseCityName(city)]
  if (cityHit && cityHit.stateCode === stateCode.toUpperCase()) {
    return { lat: cityHit.lat, lng: cityHit.lng, source: 'city' }
  }
  const state = STATE_CENTROIDS[stateCode.toUpperCase()]
  if (state) return { lat: state.lat, lng: state.lng, source: 'state' }
  return null
}

/** The store's dispatch (warehouse) location: its settings city if we recognise it, else its
 * settings state's centroid, else null (no address set, or neither resolves). */
export function resolveDispatchLocation(city: string, state: string): ResolvedLocation | null {
  const cityHit = CITY_COORDS[normaliseCityName(city)]
  if (cityHit) return { lat: cityHit.lat, lng: cityHit.lng, source: 'city' }
  const code = resolveStateCode(state)
  const centroid = code ? STATE_CENTROIDS[code] : undefined
  if (centroid) return { lat: centroid.lat, lng: centroid.lng, source: 'state' }
  return null
}
