import { describe, expect, it } from 'vitest'
import { formatPhone } from '../src/index'

describe('formatPhone', () => {
  it('shows every number with its country code and grouping (#39)', () => {
    expect(formatPhone('7021867918')).toBe('+91 70218 67918')
    expect(formatPhone('70218 67918')).toBe('+91 70218 67918')
    expect(formatPhone('+917016927275')).toBe('+91 70169 27275')
    expect(formatPhone('917016927275')).toBe('+91 70169 27275')
    expect(formatPhone('07016927275')).toBe('+91 70169 27275')
    expect(formatPhone('+971502292692')).toBe('+971 50 229 2692')
  })

  it('leaves what it cannot read as stored', () => {
    expect(formatPhone('12345')).toBe('12345')
    expect(formatPhone('')).toBe('')
  })
})
