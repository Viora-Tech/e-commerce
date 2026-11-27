import { describe, expect, it } from 'vitest'
import { findPortalDomain, portalFallbackUrl, portalHostname } from './portal'

const platform = { hostname: 'waimers.koomerce.app', kind: 'platform', isPrimary: false }
const www = { hostname: 'www.waimers.in', kind: 'custom', isPrimary: true }
const apex = { hostname: 'waimers.in', kind: 'custom', isPrimary: false }

describe('portal address pre-fill', () => {
  it('takes affiliate.<primary custom domain>, dropping www', () => {
    expect(portalHostname([platform, www, apex])).toBe('affiliate.waimers.in')
    expect(portalHostname([{ ...apex, isPrimary: true }])).toBe('affiliate.waimers.in')
    expect(portalHostname([{ ...apex, hostname: 'shop.brand.co.in', isPrimary: true }])).toBe(
      'affiliate.shop.brand.co.in',
    )
  })

  it('has nothing to offer while the primary is the platform address', () => {
    const domains = [
      { ...platform, isPrimary: true },
      { ...www, isPrimary: false },
    ]
    expect(portalHostname(domains)).toBeNull()
    expect(portalHostname([])).toBeNull()
    expect(findPortalDomain(domains)).toBeNull()
  })

  it('shows /affiliate on the primary domain as the address that always works', () => {
    expect(portalFallbackUrl([platform, www])).toBe('https://www.waimers.in/affiliate')
    expect(portalFallbackUrl([{ ...platform, isPrimary: true }])).toBe(
      'https://waimers.koomerce.app/affiliate',
    )
    expect(portalFallbackUrl([])).toBeNull()
  })

  it('finds the connected portal row by its hostname only', () => {
    const portal = { hostname: 'affiliate.waimers.in', kind: 'custom', isPrimary: false }
    const other = { hostname: 'affiliate.other.in', kind: 'custom', isPrimary: false }
    expect(findPortalDomain([platform, www, other])).toBeNull()
    expect(findPortalDomain([platform, www, other, portal])).toBe(portal)
  })
})
