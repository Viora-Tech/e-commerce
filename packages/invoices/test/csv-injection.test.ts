import { describe, expect, it } from 'vitest'
import { type Gstr3b, gstr3bCsv } from '../src/gstr3b'

/**
 * Regression: a GST CSV cell starting with =, +, -, @, tab or CR must not run as a spreadsheet
 * formula, while plain negative amounts (net of credit notes) stay numbers for the offline tool.
 */
describe('GST CSV formula injection', () => {
  const row = { taxablePaise: -1200, igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 }
  const report = (gstin: string): Gstr3b => ({
    gstin,
    period: '2026-10',
    outwardTaxable: row,
    zeroRated: row,
    nilExempt: row,
    unregisteredInterState: [{ pos: '07', taxablePaise: -1200, igstPaise: 0 }],
  })

  it('neutralises a leading formula character', () => {
    const csv = gstr3bCsv(report('=HYPERLINK("http://evil","x")'), () => 'Delhi')
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`)
    expect(csv).not.toMatch(/(^|,)=/m)
  })

  it('keeps negative amounts as numbers', () => {
    const csv = gstr3bCsv(report('07AAACA1234A1Z5'), () => 'Delhi')
    expect(csv).toContain(',-12.00,')
    expect(csv).not.toContain("'-12.00")
  })
})
