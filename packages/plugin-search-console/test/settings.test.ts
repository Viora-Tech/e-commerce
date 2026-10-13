import { describe, expect, it } from 'vitest'
import {
  parseSearchConsoleSettings,
  propertyCovers,
  REFRESH_COOLDOWN_MS,
  searchConsoleView,
  sitemapUrlFor,
  suggestProperty,
} from '../src/settings'

const site = (siteUrl: string, permissionLevel = 'siteOwner') => ({ siteUrl, permissionLevel })

describe('propertyCovers', () => {
  it('lets a domain property cover its subdomains, a URL prefix only its host', () => {
    expect(propertyCovers('sc-domain:example.in', 'www.example.in')).toBe(true)
    expect(propertyCovers('sc-domain:example.in', 'example.in')).toBe(true)
    expect(propertyCovers('sc-domain:example.in', 'notexample.in')).toBe(false)
    expect(propertyCovers('https://www.example.in/', 'www.example.in')).toBe(true)
    expect(propertyCovers('https://www.example.in/', 'example.in')).toBe(false)
  })
})

describe('suggestProperty', () => {
  const sites = [
    site('https://other.in/'),
    site('https://www.example.in/'),
    site('sc-domain:example.in'),
    site('https://shop.example.in/', 'siteUnverifiedUser'),
  ]

  it('prefers a domain property for the primary domain', () => {
    expect(suggestProperty(sites, ['www.example.in', 'example.waimers.store'])).toBe(
      'sc-domain:example.in',
    )
  })

  it('falls back to an https URL prefix, then the next domain, skipping unverified ones', () => {
    expect(suggestProperty([site('https://www.example.in/')], ['www.example.in'])).toBe(
      'https://www.example.in/',
    )
    expect(suggestProperty(sites.slice(3), ['shop.example.in'])).toBeNull()
    expect(suggestProperty([site('https://b.store/')], ['a.store', 'b.store'])).toBe(
      'https://b.store/',
    )
  })
})

describe('sitemapUrlFor', () => {
  it('uses the property host when it is one of the store domains, else the primary address', () => {
    expect(sitemapUrlFor('https://www.example.in/', ['www.example.in'], 'https://x.in')).toBe(
      'https://www.example.in/sitemap.xml',
    )
    expect(
      sitemapUrlFor('sc-domain:example.in', ['www.example.in'], 'https://www.example.in/'),
    ).toBe('https://www.example.in/sitemap.xml')
  })
})

describe('searchConsoleView', () => {
  it('never shows the token and reports the refresh cooldown', () => {
    const now = new Date('2026-10-14T10:00:00Z')
    const settings = parseSearchConsoleSettings({
      refreshToken: 'v1:secret',
      email: 'owner@example.in',
      property: 'sc-domain:example.in',
      refreshedAt: new Date(now.getTime() - 60_000).toISOString(),
    })
    const view = searchConsoleView(settings, true, now)
    expect(JSON.stringify(view)).not.toContain('secret')
    expect(view.connected).toBe(true)
    expect(view.refreshAfter).toBe(
      new Date(now.getTime() - 60_000 + REFRESH_COOLDOWN_MS).toISOString(),
    )
    expect(searchConsoleView(parseSearchConsoleSettings(null), false, now).refreshAfter).toBeNull()
  })

  it('reads anything unexpected as not connected', () => {
    expect(parseSearchConsoleSettings({ refreshToken: 42 }).refreshToken).toBe('')
  })
})
