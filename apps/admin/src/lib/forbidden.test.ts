import { describe, expect, it } from 'vitest'
import { FORBIDDEN_DIGEST, isForbidden } from './forbidden'

describe('isForbidden', () => {
  it('reads a client call (code) and a server render (digest)', () => {
    expect(isForbidden({ code: 'FORBIDDEN' })).toBe(true)
    expect(isForbidden(Object.assign(new Error('x'), { digest: FORBIDDEN_DIGEST }))).toBe(true)
  })

  it('leaves every other failure alone', () => {
    expect(isForbidden(new Error('FORBIDDEN'))).toBe(false)
    expect(isForbidden({ code: 'NOT_FOUND' })).toBe(false)
    expect(isForbidden({ digest: '12345' })).toBe(false)
    expect(isForbidden(null)).toBe(false)
  })
})
