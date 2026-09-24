/**
 * India state/UT boundaries for the home page's real order map, from `@svg-maps/india` v2.0.0
 * (CC BY 4.0, https://github.com/VictorCazanave/svg-maps/tree/master/packages/india). Used as
 * inline SVG paths (`INDIA_MAP_LOCATIONS`), not the package's runtime `<SVGMap>` component, so
 * the shell stays ours. Full notice: `THIRD_PARTY_NOTICES.md`.
 *
 * Known limitation: this source predates the August 2019 reorganisation, so it has one path for
 * the whole former state of Jammu & Kashmir and no separate Ladakh outline (it still splits Dadra
 * & Nagar Haveli from Daman & Diu too, merged into one UT since 2020). Until a source with the
 * current boundary is available, `STATE_CODE_TO_MAP_ID` folds Ladakh's orders into the same path
 * as Jammu & Kashmir; the map's tooltip and legend say so by combining their labels rather than
 * hiding the difference. Every path still renders as Indian territory either way.
 */
import indiaMap from '@svg-maps/india'

export const INDIA_MAP_LABEL = indiaMap.label
export const INDIA_MAP_VIEWBOX = indiaMap.viewBox
export const INDIA_MAP_LOCATIONS: { id: string; name: string; path: string }[] = indiaMap.locations

/** Our two-letter shipping-address state code (`data/india.ts`) -> the map package's location id. */
export const STATE_CODE_TO_MAP_ID: Record<string, string> = {
  AP: 'ap',
  AR: 'ar',
  AS: 'as',
  BR: 'br',
  CG: 'ct',
  CH: 'ch',
  DL: 'dl',
  GA: 'ga',
  GJ: 'gj',
  HR: 'hr',
  HP: 'hp',
  JK: 'jk',
  JH: 'jh',
  KA: 'ka',
  KL: 'kl',
  // No separate Ladakh outline in this source; folded into the same path as J&K (see above).
  LA: 'jk',
  MP: 'mp',
  MH: 'mh',
  MN: 'mn',
  ML: 'ml',
  MZ: 'mz',
  NL: 'nl',
  OD: 'or',
  PY: 'py',
  PB: 'pb',
  RJ: 'rj',
  SK: 'sk',
  TN: 'tn',
  TS: 'tg',
  TR: 'tr',
  UP: 'up',
  UK: 'ut',
  WB: 'wb',
}

/**
 * Approximate centre of each path's bounding box (computed once from the package's path data),
 * for the pulsing "latest order" dots. `an`, `ap` and `tr` are hand-placed: their paths have
 * multiple sub-shapes (island groups) the bounding-box pass could not resolve on its own.
 */
export const MAP_ID_CENTER: Record<string, { x: number; y: number }> = {
  an: { x: 520, y: 610 },
  ap: { x: 249, y: 520 },
  ar: { x: 550, y: 224 },
  as: { x: 516, y: 271 },
  br: { x: 377, y: 274 },
  ch: { x: 179, y: 160 },
  ct: { x: 296, y: 388 },
  dd: { x: 54, y: 391 },
  dl: { x: 186, y: 210 },
  dn: { x: 102, y: 405 },
  ga: { x: 122, y: 512 },
  gj: { x: 66, y: 355 },
  hp: { x: 191, y: 133 },
  hr: { x: 164, y: 195 },
  jh: { x: 342, y: 310 },
  jk: { x: 173, y: 61 },
  ka: { x: 171, y: 519 },
  kl: { x: 166, y: 615 },
  ld: { x: 99, y: 627 },
  mh: { x: 180, y: 435 },
  ml: { x: 484, y: 283 },
  mn: { x: 537, y: 301 },
  mp: { x: 257, y: 284 },
  mz: { x: 516, y: 337 },
  nl: { x: 546, y: 270 },
  or: { x: 340, y: 405 },
  pb: { x: 151, y: 152 },
  py: { x: 268, y: 546 },
  rj: { x: 165, y: 249 },
  sk: { x: 425, y: 235 },
  tg: { x: 237, y: 457 },
  tn: { x: 211, y: 609 },
  tr: { x: 500, y: 320 },
  up: { x: 269, y: 245 },
  ut: { x: 232, y: 175 },
  wb: { x: 435, y: 310 },
}
