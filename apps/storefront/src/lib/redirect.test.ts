import { describe, expect, it } from 'vitest'
import { redirectTo } from './redirect'

describe('redirectTo', () => {
  it("keeps the shopper's host: a relative Location, never the server's bind address", () => {
    const res = redirectTo('/checkout', 303)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/checkout')
  })

  it('carries cookies set on it', () => {
    const res = redirectTo('/checkout')
    res.cookies.set('cart', 'abc', { path: '/' })
    expect(res.status).toBe(307)
    expect(res.headers.get('set-cookie')).toContain('cart=abc')
  })
})
