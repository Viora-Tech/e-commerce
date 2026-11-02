import { describe, expect, it } from 'vitest'
import { csvCell as payoutsCell } from '../src/payouts'
import { csvCell as statsCell } from '../src/stats'

/**
 * Regression: a self-registered affiliate controls free text (e.g. their name) that lands in a
 * CSV export the merchant opens. A leading =, +, -, or @ must be neutralised so a spreadsheet
 * does not execute it as a formula (CSV formula injection).
 */
describe('CSV formula injection neutralisation', () => {
  const dangerous = ['=1+1', '+1', '-1+1', '@SUM(A1:A9)', '=HYPERLINK("http://evil","x")']

  for (const cell of [statsCell, payoutsCell]) {
    for (const value of dangerous) {
      it(`neutralises a leading formula char: ${JSON.stringify(value)}`, () => {
        const out = cell(value)
        // The dangerous char must no longer be the first character the spreadsheet parses.
        const inner = out.startsWith('"') ? out.slice(1) : out
        expect(inner.startsWith("'")).toBe(true)
        expect(/^["'=+\-@]*=/.test(out)).toBe(true) // the '=' survives as data, prefixed by a quote
      })
    }
  }

  it('leaves ordinary values unchanged', () => {
    expect(statsCell('Acme Co')).toBe('Acme Co')
    expect(statsCell(123)).toBe('123')
    expect(statsCell(null)).toBe('')
  })

  it('still escapes quotes and separators', () => {
    expect(statsCell('a,b')).toBe('"a,b"')
    expect(statsCell('she said "hi"')).toBe('"she said ""hi"""')
  })
})
