import { describe, expect, it } from 'vitest'
import {
  normaliseUmamiUrl,
  parseUmamiSettings,
  UmamiSettingsPatchSchema,
  umamiAllowed,
  umamiApiBase,
  umamiScriptSrc,
  umamiSettingsView,
  umamiTracker,
} from '../src/settings'

const SITE = '4f1e2a7c-9b3d-4c5e-8f60-1a2b3c4d5e6f'

describe('normaliseUmamiUrl', () => {
  it.each([
    ['analytics.example.com', 'https://analytics.example.com'],
    ['https://analytics.example.com/', 'https://analytics.example.com'],
    ['https://example.com/umami/', 'https://example.com/umami'],
    ['https://analytics.example.com/script.js', 'https://analytics.example.com'],
    [`https://analytics.example.com/websites/${SITE}`, 'https://analytics.example.com'],
    ['http://localhost:3000', 'http://localhost:3000'],
    ['https://cloud.umami.is/websites/abc', 'https://cloud.umami.is'],
    ['https://api.umami.is/v1', 'https://cloud.umami.is'],
  ])('reads %s as %s', (input, expected) => {
    expect(normaliseUmamiUrl(input)).toBe(expected)
  })

  it.each(['', '   ', 'javascript:alert(1)', 'ftp://example.com', 'https://user:pw@example.com'])(
    'refuses %j',
    (input) => {
      expect(normaliseUmamiUrl(input)).toBeNull()
    },
  )
})

describe('Umami addresses', () => {
  it('puts the API under /api for a self-hosted Umami and on api.umami.is for Cloud', () => {
    expect(umamiApiBase('https://example.com/umami')).toBe('https://example.com/umami/api')
    expect(umamiApiBase('https://cloud.umami.is')).toBe('https://api.umami.is/v1')
  })

  it('loads the tracker from the Umami address, or Cloud’s', () => {
    expect(umamiScriptSrc('https://analytics.example.com')).toBe(
      'https://analytics.example.com/script.js',
    )
    expect(umamiScriptSrc('https://cloud.umami.is')).toBe('https://cloud.umami.is/script.js')
  })
})

describe('umamiTracker', () => {
  it('needs an address and a website id', () => {
    expect(umamiTracker(parseUmamiSettings({}))).toBeNull()
    expect(umamiTracker(parseUmamiSettings({ url: 'https://a.example' }))).toBeNull()
    expect(
      umamiTracker(parseUmamiSettings({ url: 'https://a.example', websiteId: 'not-a-uuid' })),
    ).toBeNull()
    expect(
      umamiTracker(parseUmamiSettings({ url: 'https://a.example', websiteId: SITE.toUpperCase() })),
    ).toEqual({ src: 'https://a.example/script.js', websiteId: SITE, waitForConsent: true })
  })
})

describe('umamiAllowed', () => {
  const tracker = { src: 'https://a.example/script.js', websiteId: SITE, waitForConsent: true }

  it('waits for a yes to analytics by default', () => {
    expect(umamiAllowed(tracker, null)).toBe(false)
    expect(umamiAllowed(tracker, { analytics: false })).toBe(false)
    expect(umamiAllowed(tracker, { analytics: true })).toBe(true)
  })

  it('counts unanswered visitors when the store does not wait, never after a no', () => {
    const eager = { ...tracker, waitForConsent: false }
    expect(umamiAllowed(eager, null)).toBe(true)
    expect(umamiAllowed(eager, { analytics: false })).toBe(false)
  })
})

describe('settings', () => {
  it('falls back to defaults for a broken entry', () => {
    expect(parseUmamiSettings('nonsense')).toEqual(parseUmamiSettings({}))
  })

  it('never shows the key, only whether one is saved', () => {
    const view = umamiSettingsView(
      parseUmamiSettings({ url: 'https://a.example', websiteId: SITE, apiKey: 'v2.cipher' }),
    )
    expect(view).toMatchObject({ hasApiKey: true, tracking: true, reporting: true, cloud: false })
    expect(JSON.stringify(view)).not.toContain('cipher')
  })

  it('leaves out of a patch what the form did not send', () => {
    expect(UmamiSettingsPatchSchema.parse({ waitForConsent: false })).toEqual({
      waitForConsent: false,
    })
  })
})
