/** SOURCE OF TRUTH: member devices tests — WHAT: user agents named in plain words / WHY: the Sessions page must name devices the way people know them */
import { describe, expect, it } from 'vitest'
import { describeUserAgent } from './devices'
import { maskEmail } from './email-change'

describe('describeUserAgent', () => {
  it('names common browsers, systems and device kinds', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0',
      ),
    ).toEqual({ browser: 'Edge', os: 'Windows', kind: 'computer' })
    expect(
      describeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'Safari', os: 'iPhone', kind: 'phone' })
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36',
      ),
    ).toEqual({ browser: 'Samsung Internet', os: 'Android', kind: 'phone' })
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome', os: 'macOS', kind: 'computer' })
  })

  it('leaves unknown parts empty', () => {
    expect(describeUserAgent(null)).toEqual({ browser: null, os: null, kind: 'computer' })
  })
})

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('asha.rao@gmail.com')).toBe('a•••@gmail.com')
    expect(maskEmail('nope')).toBe('•••')
  })
})
