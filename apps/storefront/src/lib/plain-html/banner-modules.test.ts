import { describe, expect, it } from 'vitest'
import { CONSENT_BANNER_MODULE, MARKET_BANNER_MODULE } from './banner-modules'
import { CHATWOOT_MODULE } from './chatwoot-module'
import { islandScript } from './islands'

const base = {
  bannerVersion: 2,
  tracking: { ga4: '', gtm: '', metaPixel: '', googleAds: '' },
  umami: null,
}

describe('banner and Chatwoot island modules', () => {
  it('are valid JavaScript', () => {
    for (const code of [CONSENT_BANNER_MODULE, MARKET_BANNER_MODULE, CHATWOOT_MODULE]) {
      expect(() => new Function(code)).not.toThrow()
    }
  })

  it('the inline island carries our cookie banner only for a theme without one, with its copy', () => {
    expect(islandScript(base)).not.toContain('/api/islands/consent.js')
    const code = islandScript({ ...base, consentBanner: { message: 'We use <b>cookies</b>' } })
    expect(code).toContain('/api/islands/consent.js?v=')
    expect(code).toContain('Necessary only')
    expect(code).not.toContain('<b>')
    expect(() => new Function(code)).not.toThrow()
  })

  it('the market card gets its copy as templates', () => {
    const code = islandScript({ ...base, marketBanner: true })
    expect(code).toContain('/api/islands/market.js?v=')
    expect(code).toContain('Shopping from {country}?')
    expect(code).toContain('Shop in {currency}')
  })

  it('Chatwoot waits for the category the store picked', () => {
    const code = islandScript({
      ...base,
      chatwoot: {
        widget: { baseUrl: 'https://chat.example', websiteToken: 'tok', consent: 'analytics' },
        identity: null,
      } as never,
    })
    expect(code).toContain('"consent":"analytics"')
    expect(code).toContain('/api/islands/chatwoot.js?v=')
  })
})
