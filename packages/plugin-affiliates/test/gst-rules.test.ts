import { describe, expect, it } from 'vitest'
import { payoutGstPaise, payoutNetPaise } from '../src/gst'
import { defaultStoreAffiliateSettings, parseAffiliateSettings, TDS_SECTION } from '../src/settings'
import { quarterOf, quarterRange } from '../src/tds'

describe('GST on payouts', () => {
  const gst = defaultStoreAffiliateSettings.gst

  it('adds 18% for GST-registered affiliates only, on commission less clawbacks', () => {
    expect(payoutGstPaise(gst, true, 1000_00)).toBe(180_00)
    expect(payoutGstPaise(gst, false, 1000_00)).toBe(0)
    expect(payoutGstPaise({ enabled: false, bp: 1800 }, true, 1000_00)).toBe(0)
    expect(payoutGstPaise(gst, true, 0)).toBe(0)
  })

  it('pays commission less clawback plus GST less TDS (TDS stays on the ex-GST commission)', () => {
    // ₹25,000 commission, ₹5,000 clawback: GST 18% of 20,000 = 3,600; TDS 500.
    const gstPaise = payoutGstPaise(gst, true, 20_000_00)
    expect(
      payoutNetPaise({
        grossPaise: 25_000_00,
        clawbackPaise: 5_000_00,
        gstPaise,
        tdsPaise: 500_00,
      }),
    ).toBe(23_100_00)
    expect(
      payoutNetPaise({ grossPaise: 100_00, clawbackPaise: 200_00, gstPaise: 0, tdsPaise: 0 }),
    ).toBe(0)
  })

  it('defaults the new store keys for a v1 entry', () => {
    const s = parseAffiliateSettings({ holdDays: 3, tds: { enabled: true, bp: 100 } })
    expect(s.gst).toEqual({ enabled: true, bp: 1800 })
    expect(s.requirePanAboveThreshold).toBe(false)
    expect(s.tds).toMatchObject({ bp: 100, noPanBp: 2000, section: TDS_SECTION })
  })
})

describe('26Q quarters (IST)', () => {
  it('runs April-June, July-September, October-December, January-March', () => {
    const q1 = quarterRange({ fy: 2026, quarter: 1 })
    expect(q1.from.toISOString()).toBe('2026-03-31T18:30:00.000Z')
    expect(q1.to.toISOString()).toBe('2026-06-30T18:30:00.000Z')
    const q3 = quarterRange({ fy: 2026, quarter: 3 })
    expect(q3.to.toISOString()).toBe('2026-12-31T18:30:00.000Z')
    const q4 = quarterRange({ fy: 2026, quarter: 4 })
    expect(q4.from.toISOString()).toBe('2026-12-31T18:30:00.000Z')
    expect(q4.to.toISOString()).toBe('2027-03-31T18:30:00.000Z')
  })

  it('puts an instant in its IST quarter at the edges', () => {
    // 31 March 23:59 IST is still Q4 of FY 2025-26; 1 April 00:00 IST is Q1 of 2026-27.
    expect(quarterOf(new Date('2026-03-31T18:29:00Z'))).toEqual({ fy: 2025, quarter: 4 })
    expect(quarterOf(new Date('2026-03-31T18:30:00Z'))).toEqual({ fy: 2026, quarter: 1 })
    expect(quarterOf(new Date('2026-10-24T12:00:00Z'))).toEqual({ fy: 2026, quarter: 3 })
    expect(quarterOf(new Date('2026-12-31T18:30:00Z'))).toEqual({ fy: 2026, quarter: 4 })
  })
})
