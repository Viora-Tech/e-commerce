import { describe, expect, it } from 'vitest'
import { isCrossOriginBrowserRequest } from './request-site'

// Security audit 2026-10-06 (A-07): a storefront on the admin's site posting to /api/rpc.
describe('isCrossOriginBrowserRequest', () => {
  const req = (site?: string) => new Headers(site === undefined ? {} : { 'sec-fetch-site': site })

  it('refuses requests a browser sends from another origin, same site included', () => {
    expect(isCrossOriginBrowserRequest(req('same-site'))).toBe(true)
    expect(isCrossOriginBrowserRequest(req('cross-site'))).toBe(true)
  })

  it("allows the admin's own pages, typed URLs and non-browser callers", () => {
    expect(isCrossOriginBrowserRequest(req('same-origin'))).toBe(false)
    expect(isCrossOriginBrowserRequest(req('none'))).toBe(false)
    expect(isCrossOriginBrowserRequest(req())).toBe(false)
  })
})
