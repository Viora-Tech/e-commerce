import { describe, expect, it } from 'vitest'
import {
  accountIdFromUrl,
  CHATWOOT_CLOUD,
  chatwootAllowed,
  chatwootLinks,
  chatwootSettingsView,
  chatwootWidgetOf,
  normaliseChatwootUrl,
  parseChatwootSettings,
} from '../src'

describe('normaliseChatwootUrl', () => {
  it('keeps a self-hosted origin and trims dashboard links back to the root', () => {
    expect(normaliseChatwootUrl('support.shop.in')).toBe('https://support.shop.in')
    expect(normaliseChatwootUrl('https://support.shop.in/app/accounts/3/dashboard')).toBe(
      'https://support.shop.in',
    )
    expect(normaliseChatwootUrl('https://shop.in/chat/')).toBe('https://shop.in/chat')
    expect(normaliseChatwootUrl('https://shop.in/chat/packs/js/sdk.js')).toBe(
      'https://shop.in/chat',
    )
  })

  it('maps chatwoot.com to Chatwoot Cloud', () => {
    expect(normaliseChatwootUrl('chatwoot.com')).toBe(CHATWOOT_CLOUD)
    expect(normaliseChatwootUrl('https://app.chatwoot.com/app/accounts/9/inbox')).toBe(
      CHATWOOT_CLOUD,
    )
  })

  it('refuses what is not a web address', () => {
    expect(normaliseChatwootUrl('')).toBeNull()
    expect(normaliseChatwootUrl('ftp://x.in')).toBeNull()
    expect(normaliseChatwootUrl('https://user:pw@x.in')).toBeNull()
    expect(normaliseChatwootUrl('http://')).toBeNull()
  })

  it('reads the account id out of a pasted dashboard link', () => {
    expect(accountIdFromUrl('https://app.chatwoot.com/app/accounts/42/dashboard')).toBe('42')
    expect(accountIdFromUrl('https://app.chatwoot.com')).toBeNull()
  })
})

describe('settings', () => {
  it('defaults: no widget, nothing ready, chat loads without waiting for consent', () => {
    const s = parseChatwootSettings(undefined)
    expect(s.consent).toBe('necessary')
    expect(s.identifyShoppers).toBe(true)
    expect(s.syncContacts).toBe(true)
    expect(chatwootWidgetOf(s)).toBeNull()
    expect(chatwootSettingsView(s)).toMatchObject({ chat: false, api: false, dashboardUrl: null })
  })

  it('a broken entry falls back to the defaults', () => {
    expect(parseChatwootSettings({ consent: 'always' }).consent).toBe('necessary')
  })

  it('the view never carries a secret, only whether one is saved', () => {
    const view = chatwootSettingsView(
      parseChatwootSettings({
        baseUrl: 'https://app.chatwoot.com',
        accountId: '3',
        apiToken: 'v2.blob',
        websiteToken: 'webtok12345',
        hmacToken: 'v2.other',
      }),
    )
    expect(JSON.stringify(view)).not.toContain('v2.')
    expect(view).toMatchObject({
      hasApiToken: true,
      hasHmacToken: true,
      chat: true,
      identifying: true,
      api: true,
      cloud: true,
      dashboardUrl: 'https://app.chatwoot.com/app/accounts/3/dashboard',
    })
  })

  it('identifying needs the switch and an HMAC token', () => {
    const base = { baseUrl: 'https://cw.shop.in', websiteToken: 'webtok12345' }
    expect(chatwootSettingsView(parseChatwootSettings(base)).identifying).toBe(false)
    expect(
      chatwootSettingsView(
        parseChatwootSettings({ ...base, hmacToken: 'x', identifyShoppers: false }),
      ).identifying,
    ).toBe(false)
  })

  it('builds dashboard links', () => {
    const links = chatwootLinks('https://cw.shop.in', '3')
    expect(links.conversation(12)).toBe('https://cw.shop.in/app/accounts/3/conversations/12')
    expect(links.contact(7)).toBe('https://cw.shop.in/app/accounts/3/contacts/7')
  })
})

describe('chatwootAllowed', () => {
  const widget = { baseUrl: 'https://cw.shop.in', websiteToken: 'webtok12345' }

  it('necessary: loads for everyone, even after a no', () => {
    const w = { ...widget, consent: 'necessary' as const }
    expect(chatwootAllowed(w, null)).toBe(true)
    expect(chatwootAllowed(w, { analytics: false, marketing: false })).toBe(true)
  })

  it('analytics or marketing: only after that category is allowed', () => {
    const w = { ...widget, consent: 'marketing' as const }
    expect(chatwootAllowed(w, null)).toBe(false)
    expect(chatwootAllowed(w, { analytics: true, marketing: false })).toBe(false)
    expect(chatwootAllowed(w, { analytics: false, marketing: true })).toBe(true)
    const a = { ...widget, consent: 'analytics' as const }
    expect(chatwootAllowed(a, { analytics: true, marketing: false })).toBe(true)
  })
})
