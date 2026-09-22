/**
 * Code 128 (subset B, plus subset C for long digit runs) as bar widths, so a
 * template can draw it with plain rectangles and no image step. Scanners on
 * packing benches read the order or invoice number from it.
 */
const PATTERNS = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
]
const START_B = 104
const START_C = 105
const CODE_B = 100
const CODE_C = 99
const STOP = 106

/** Symbol values for `text`, start and check included, stop excluded. */
export function code128Values(text: string): number[] {
  const chars = [...text]
  for (const ch of chars) {
    const c = ch.charCodeAt(0)
    if (c < 32 || c > 126) throw new Error(`Code 128 B cannot encode ${JSON.stringify(ch)}`)
  }
  const digitsAt = (i: number) => {
    let n = 0
    while (i + n < chars.length && /\d/.test(chars[i + n] ?? '')) n++
    return n
  }
  const values: number[] = []
  let set: 'B' | 'C' = digitsAt(0) >= 4 && digitsAt(0) % 2 === 0 ? 'C' : 'B'
  values.push(set === 'C' ? START_C : START_B)
  let i = 0
  while (i < chars.length) {
    const run = digitsAt(i)
    if (set === 'B' && run >= 6) {
      // Switch to C for an even run of digits; an odd leftover stays in B first.
      if (run % 2 === 1) {
        values.push((chars[i] ?? ' ').charCodeAt(0) - 32)
        i++
      }
      values.push(CODE_C)
      set = 'C'
      continue
    }
    if (set === 'C') {
      if (run >= 2) {
        values.push(Number(`${chars[i]}${chars[i + 1]}`))
        i += 2
        continue
      }
      values.push(CODE_B)
      set = 'B'
      continue
    }
    values.push((chars[i] ?? ' ').charCodeAt(0) - 32)
    i++
  }
  const check = values.reduce((sum, v, idx) => sum + v * (idx === 0 ? 1 : idx), 0) % 103
  values.push(check)
  return values
}

/**
 * Alternating bar and space widths in modules, starting with a bar, for the
 * whole symbol including the stop pattern.
 */
export function code128Widths(text: string): number[] {
  return [...code128Values(text), STOP].flatMap((v) => [...(PATTERNS[v] ?? '')].map(Number))
}
