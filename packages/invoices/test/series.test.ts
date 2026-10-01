import { describe, expect, it } from 'vitest'
import {
  counterYear,
  DEFAULT_SERIES,
  financialYear,
  formatSeriesNumber,
  InvoiceSettingsSchema,
  nextNumberProblem,
  type Series,
} from '../src'
import { sampleDocument } from '../src/sample'
import { templateView } from '../src/templates/view'

const inv = DEFAULT_SERIES[0] as Series
const march = financialYear(new Date('2027-03-31T12:00:00+05:30'))
const april = financialYear(new Date('2027-04-01T00:30:00+05:30'))

describe('series reset', () => {
  it('keys the counter by financial year when the series restarts every April', () => {
    expect(march.startYear).toBe(2026)
    expect(april.startYear).toBe(2027)
    expect(counterYear(inv, march)).toBe(2026)
    expect(counterYear(inv, april)).toBe(2027)
    expect(counterYear({ ...inv, resetEachYear: true }, april)).toBe(2027)
  })

  it('keeps one counter for good when the restart is off', () => {
    const running = { ...inv, resetEachYear: false }
    expect(counterYear(running, march)).toBe(0)
    expect(counterYear(running, april)).toBe(0)
  })

  it('treats series saved before the option existed as restarting', () => {
    const parsed = InvoiceSettingsSchema.parse({})
    expect(parsed.series[0]?.resetEachYear).toBeUndefined()
    expect(counterYear(parsed.series[0] as Series, april)).toBe(april.startYear)
    const off = InvoiceSettingsSchema.parse({
      series: DEFAULT_SERIES.map((s) => (s.id === 'inv' ? { ...s, resetEachYear: false } : s)),
    })
    expect(off.series[0]?.resetEachYear).toBe(false)
  })

  it('prints the year in the number only where the prefix asks for it', () => {
    expect(formatSeriesNumber(inv, april, 1)).toBe('INV/27-28/0001')
    expect(formatSeriesNumber({ ...inv, pattern: 'WMR-' }, april, 42)).toBe('WMR-0042')
  })
})

describe('nextNumberProblem', () => {
  it('allows the current next number or anything higher', () => {
    expect(nextNumberProblem(5, 5)).toBeNull()
    expect(nextNumberProblem(5, 500)).toBeNull()
  })

  it('refuses going back, zero, fractions and huge numbers', () => {
    expect(nextNumberProblem(5, 4)).toMatch(/up to 4 are already used/)
    expect(nextNumberProblem(1, 0)).toMatch(/whole number/)
    expect(nextNumberProblem(1, 2.5)).toMatch(/whole number/)
    expect(nextNumberProblem(1, 100_000_000)).toMatch(/too big/)
  })
})

describe('composition scheme on documents', () => {
  const settings = InvoiceSettingsSchema.parse({})

  it('prints a bill of supply with the rule 5(1)(g) note', () => {
    const doc = { ...sampleDocument(settings, 'tax_invoice', 'Waimers'), composition: true }
    const view = templateView({ doc, settings, assets: { logo: null, signature: null } })
    expect(view.title).toBe('Bill of Supply')
    expect(view.endorsement).toBe(
      'Composition taxable person, not eligible to collect tax on supplies',
    )
  })

  it('leaves regular invoices alone', () => {
    const view = templateView({
      doc: sampleDocument(settings, 'tax_invoice', 'Waimers'),
      settings,
      assets: { logo: null, signature: null },
    })
    expect(view.title).toBe('Tax Invoice')
    expect(view.endorsement).toBeNull()
  })
})

describe('{GST} in a series pattern', () => {
  const fy = financialYear(new Date('2026-10-02T12:00:00+05:30'))
  const parse = (pattern: string) =>
    InvoiceSettingsSchema.safeParse({
      series: DEFAULT_SERIES.map((s) => (s.id === 'inv' ? { ...s, pattern } : s)),
    })

  it('prints the issuing GST number’s prefix where the pattern asks for it', () => {
    const series = { ...inv, pattern: '{GST}/{FY}/' }
    expect(formatSeriesNumber(series, fy, 7, 'BLR')).toBe('BLR/26-27/0007')
    expect(formatSeriesNumber(series, fy, 7, 'HR')).toBe('HR/26-27/0007')
    // A pattern without {GST} ignores it, so single-GSTIN numbers do not change.
    expect(formatSeriesNumber(inv, fy, 7, 'BLR')).toBe('INV/26-27/0007')
  })

  it('a blank {GST} takes one separator with it', () => {
    expect(formatSeriesNumber({ ...inv, pattern: '{GST}/{FY}/' }, fy, 1)).toBe('26-27/0001')
    expect(formatSeriesNumber({ ...inv, pattern: 'INV-{GST}/' }, fy, 1)).toBe('INV-0001')
  })

  it('accepts {GST} and {FY} once each in any order, lower case too', () => {
    expect(parse('{GST}/{FY}/').success).toBe(true)
    expect(parse('{fy}{gst}/').success).toBe(true)
    expect(parse('{GST}{GST}/').success).toBe(false)
    expect(parse('{STATE}/').success).toBe(false)
  })

  it('counts {GST} as 5 characters against the 16-character limit', () => {
    // INV/ + 5 + / + 26-27 + / + 0001 = 20: refused before a long prefix can overflow.
    const long = parse('INV/{GST}/{FY}/')
    expect(long.success).toBe(false)
    expect(long.error?.issues[0]?.message).toMatch(/16/)
    expect(parse('{GST}/{FY}/').success).toBe(true)
  })
})
