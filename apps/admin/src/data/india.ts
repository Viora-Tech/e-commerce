/** Indian states and union territories by the two-letter code stored on addresses. */
const PAIRS: readonly [string, string][] = [
  ['AP', 'Andhra Pradesh'],
  ['AR', 'Arunachal Pradesh'],
  ['AS', 'Assam'],
  ['BR', 'Bihar'],
  ['CG', 'Chhattisgarh'],
  ['CH', 'Chandigarh'],
  ['DL', 'Delhi'],
  ['GA', 'Goa'],
  ['GJ', 'Gujarat'],
  ['HR', 'Haryana'],
  ['HP', 'Himachal Pradesh'],
  ['JK', 'Jammu and Kashmir'],
  ['JH', 'Jharkhand'],
  ['KA', 'Karnataka'],
  ['KL', 'Kerala'],
  ['LA', 'Ladakh'],
  ['MP', 'Madhya Pradesh'],
  ['MH', 'Maharashtra'],
  ['MN', 'Manipur'],
  ['ML', 'Meghalaya'],
  ['MZ', 'Mizoram'],
  ['NL', 'Nagaland'],
  ['OD', 'Odisha'],
  ['PY', 'Puducherry'],
  ['PB', 'Punjab'],
  ['RJ', 'Rajasthan'],
  ['SK', 'Sikkim'],
  ['TN', 'Tamil Nadu'],
  ['TS', 'Telangana'],
  ['TR', 'Tripura'],
  ['UP', 'Uttar Pradesh'],
  ['UK', 'Uttarakhand'],
  ['WB', 'West Bengal'],
]

export const INDIAN_STATES = PAIRS.map(([code, name]) => ({ code, name }))

/**
 * Approximate position of each state on a 100 x 110 viewBox, loosely following real
 * geography (north at the top, west at the left) for the home page's mini order map.
 * An original, simplified layout (not traced from any map), so it carries no
 * third-party notice; states missing here (small union territories) are skipped.
 */
const GRID: readonly [string, number, number][] = [
  ['JK', 42, 6],
  ['LA', 55, 4],
  ['HP', 40, 14],
  ['UK', 48, 18],
  ['PB', 33, 15],
  ['CH', 36, 17],
  ['HR', 36, 20],
  ['DL', 39, 22],
  ['RJ', 25, 30],
  ['UP', 48, 27],
  ['BR', 60, 29],
  ['SK', 68, 23],
  ['AS', 75, 28],
  ['AR', 82, 20],
  ['NL', 84, 29],
  ['MN', 83, 34],
  ['MZ', 80, 37],
  ['TR', 76, 35],
  ['ML', 78, 30],
  ['GJ', 18, 42],
  ['MP', 45, 41],
  ['JH', 62, 39],
  ['WB', 68, 39],
  ['CG', 52, 46],
  ['MH', 32, 53],
  ['OD', 60, 49],
  ['TS', 48, 57],
  ['AP', 50, 65],
  ['GA', 26, 61],
  ['KA', 35, 65],
  ['PY', 46, 75],
  ['TN', 42, 77],
  ['KL', 34, 77],
]

export const INDIAN_STATE_POSITIONS: Record<string, { x: number; y: number }> = Object.fromEntries(
  GRID.map(([code, x, y]) => [code, { x, y }]),
)
