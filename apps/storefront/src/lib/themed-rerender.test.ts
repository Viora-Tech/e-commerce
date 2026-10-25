import { describe, expect, it } from 'vitest'
import { isRerender, RERENDER_COOKIE, readRerenderCookie, rerenderValue } from './themed-rerender'

describe('themed rerender cookie', () => {
  it('names one path, in a value that needs no escaping', () => {
    const value = rerenderValue('/pages/this-does-not-exist')
    expect(value).toMatch(/^[a-z0-9]+$/)
    expect(value).toBe(rerenderValue('/pages/this-does-not-exist'))
    expect(value).not.toBe(rerenderValue('/pages/this-does-not-exist-either'))
  })

  it('marks only the reload of the same path', () => {
    const value = rerenderValue('/products/gone')
    expect(isRerender(value, '/products/gone')).toBe(true)
    expect(isRerender(value, '/products/other')).toBe(false)
    expect(isRerender(undefined, '/products/gone')).toBe(false)
  })

  it('reads its value out of document.cookie', () => {
    expect(readRerenderCookie(`theme=dark; ${RERENDER_COOKIE}=abc123; wc_cart=x`)).toBe('abc123')
    expect(readRerenderCookie('theme=dark')).toBeUndefined()
    expect(readRerenderCookie(`x${RERENDER_COOKIE}=nope`)).toBeUndefined()
  })
})
