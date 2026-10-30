import { describe, expect, it } from 'vitest'
import { rateWebVital, WebVitalBeaconSchema } from './web-vitals'

describe('rateWebVital', () => {
  it('uses Google’s bands, inclusive at the Good edge', () => {
    expect(rateWebVital('LCP', 2500)).toBe('good')
    expect(rateWebVital('LCP', 3000)).toBe('needs-work')
    expect(rateWebVital('LCP', 4001)).toBe('poor')
    expect(rateWebVital('INP', 200)).toBe('good')
    expect(rateWebVital('INP', 501)).toBe('poor')
    expect(rateWebVital('CLS', 0.1)).toBe('good')
    expect(rateWebVital('CLS', 0.2)).toBe('needs-work')
  })
})

describe('WebVitalBeaconSchema', () => {
  it('takes one page’s readings', () => {
    const r = WebVitalBeaconSchema.safeParse({
      path: '/products/a',
      device: 'mobile',
      readings: [{ metric: 'LCP', value: 1800 }],
    })
    expect(r.success).toBe(true)
  })

  it('refuses unknown metrics, devices and absurd values', () => {
    const base = { path: '/', device: 'desktop' }
    expect(
      WebVitalBeaconSchema.safeParse({ ...base, readings: [{ metric: 'FCP', value: 1 }] }).success,
    ).toBe(false)
    expect(
      WebVitalBeaconSchema.safeParse({
        ...base,
        device: 'tv',
        readings: [{ metric: 'LCP', value: 1 }],
      }).success,
    ).toBe(false)
    expect(
      WebVitalBeaconSchema.safeParse({ ...base, readings: [{ metric: 'LCP', value: -1 }] }).success,
    ).toBe(false)
  })
})
