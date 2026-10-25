import { describe, expect, it } from 'vitest'
import {
  featuresUrl,
  GrowthbookSettingsPatchSchema,
  growthbookApiBase,
  growthbookAppUrl,
  growthbookConnection,
  growthbookSettingsView,
  isClientKey,
  normaliseGrowthbookUrl,
  parseGrowthbookSettings,
} from '../src/settings'

describe('normaliseGrowthbookUrl', () => {
  it.each([
    ['gb.example.com', 'https://gb.example.com'],
    ['https://gb.example.com/', 'https://gb.example.com'],
    ['http://localhost:3100', 'http://localhost:3100'],
    ['https://gb.example.com/api/features/sdk-abc', 'https://gb.example.com'],
    ['https://example.com/growthbook/api/v1', 'https://example.com/growthbook'],
    ['https://app.growthbook.io/features', 'https://cdn.growthbook.io'],
    ['cdn.growthbook.io', 'https://cdn.growthbook.io'],
  ])('reads %s as %s', (input, expected) => {
    expect(normaliseGrowthbookUrl(input)).toBe(expected)
  })

  it.each(['', '  ', 'javascript:alert(1)', 'ftp://gb.example', 'https://u:p@gb.example'])(
    'refuses %j',
    (input) => {
      expect(normaliseGrowthbookUrl(input)).toBeNull()
    },
  )
})

describe('GrowthBook addresses', () => {
  it('reads features from the API host and the REST API under /api/v1', () => {
    expect(featuresUrl('https://gb.example', 'sdk-abc123')).toBe(
      'https://gb.example/api/features/sdk-abc123',
    )
    expect(growthbookApiBase('https://gb.example')).toBe('https://gb.example/api/v1')
    expect(growthbookApiBase('https://cdn.growthbook.io')).toBe('https://api.growthbook.io/api/v1')
  })

  it('opens Cloud’s app, or the saved address for a self-hosted GrowthBook', () => {
    expect(
      growthbookAppUrl(parseGrowthbookSettings({ apiHost: 'https://cdn.growthbook.io' })),
    ).toBe('https://app.growthbook.io')
    expect(growthbookAppUrl(parseGrowthbookSettings({ apiHost: 'https://gb.example' }))).toBeNull()
    expect(
      growthbookAppUrl(
        parseGrowthbookSettings({ apiHost: 'https://gb.example', appUrl: 'gb-app.example/' }),
      ),
    ).toBe('https://gb-app.example')
  })
})

describe('growthbookConnection', () => {
  it('needs an address and an sdk- client key', () => {
    expect(isClientKey('sdk-AbC123xyz')).toBe(true)
    expect(isClientKey('secret_abc')).toBe(false)
    expect(growthbookConnection(parseGrowthbookSettings({}))).toBeNull()
    expect(
      growthbookConnection(parseGrowthbookSettings({ apiHost: 'gb.example', clientKey: 'key' })),
    ).toBeNull()
    expect(
      growthbookConnection(
        parseGrowthbookSettings({ apiHost: 'gb.example/', clientKey: 'sdk-abc123' }),
      ),
    ).toEqual({ apiHost: 'https://gb.example', clientKey: 'sdk-abc123', decryptionKey: '' })
  })
})

describe('settings', () => {
  it('falls back to defaults for a broken entry', () => {
    expect(parseGrowthbookSettings('nonsense')).toEqual(parseGrowthbookSettings({}))
  })

  it('never shows the secret key, only whether one is saved', () => {
    const view = growthbookSettingsView(
      parseGrowthbookSettings({
        apiHost: 'https://cdn.growthbook.io',
        clientKey: 'sdk-abc123',
        secretKey: 'v2.cipher',
      }),
    )
    expect(view).toMatchObject({ hasSecretKey: true, assigning: true, listing: true, cloud: true })
    expect(JSON.stringify(view)).not.toContain('cipher')
  })

  it('leaves out of a patch what the form did not send', () => {
    expect(GrowthbookSettingsPatchSchema.parse({ clientKey: ' sdk-abc123 ' })).toEqual({
      clientKey: 'sdk-abc123',
    })
  })
})
