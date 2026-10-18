import { definePlugin } from '@commerce/plugins'
import { parseUmamiSettings, UMAMI_ID } from './settings'

/**
 * Umami visitor analytics. The storefront loads the store's Umami tracker (cookieless; by
 * default only after the shopper allows analytics), and the Analytics page reads visitors,
 * page views, top pages, referrers, campaigns, devices, browsers and countries from Umami's
 * API. Settings live in `store.apps` (no table); the API key is encrypted there. Umami itself
 * runs elsewhere (Umami Cloud or a self-hosted server); no Umami code is copied here.
 */
export const umamiPlugin = definePlugin({
  id: UMAMI_ID,
  name: 'Umami',
  version: '1.0.0',
  kind: 'connection',
  category: 'analytics',
  company: 'Umami',
  description:
    'See who visits your store: visitors, top pages, where they came from, campaigns, devices and countries. Cookieless.',
  access: {
    resources: [
      { resource: 'visits', level: 'read', why: 'Visitors, page views and where they came from' },
    ],
    summary: 'counts visits',
    shares: [
      {
        when: 'Every page view on your store',
        what: 'Page address, referrer, device, browser and country; no cookies',
      },
    ],
  },
  setupState: (raw) => {
    const s = parseUmamiSettings(raw)
    return { connected: s.url !== '' && s.websiteId !== '', problem: null }
  },
  provides: {},
  credits: [
    {
      name: 'Umami',
      url: 'https://github.com/umami-software/umami',
      license: 'MIT',
      note: 'Visitor analytics: its tracker and API',
    },
  ],
  admin: {
    icon: 'BarChart3',
    pages: [{ path: '', title: 'Settings', navLabel: 'Settings', icon: 'Settings' }],
  },
})
