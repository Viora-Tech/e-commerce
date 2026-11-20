/** SOURCE OF TRUTH: imported app embed tests — the theme's Shopify app embeds are read, never changed */
import { describe, expect, it } from 'vitest'
import { importedAppEmbeds } from './imported-app-embeds'

describe('importedAppEmbeds', () => {
  it('lists each app embed with the app of ours that draws it', () => {
    const settings = {
      colors: '#000',
      blocks: {
        '1': { type: 'shopify://apps/inbox/blocks/chat/abc', disabled: false, settings: {} },
        '2': { type: 'shopify://apps/judge-me-reviews/blocks/judgeme_core/x', disabled: true },
        '3': { type: 'shopify://apps/pandectes-gdpr/blocks/banner/y' },
        '4': { type: 'not-an-app' },
      },
    }
    const before = JSON.stringify(settings)
    expect(importedAppEmbeds(settings)).toEqual([
      {
        id: '1',
        type: 'shopify://apps/inbox/blocks/chat/abc',
        name: 'Inbox: Chat',
        enabled: true,
        ours: 'inbox',
      },
      {
        id: '2',
        type: 'shopify://apps/judge-me-reviews/blocks/judgeme_core/x',
        name: 'Judge me reviews: Judgeme core',
        enabled: false,
        ours: 'reviews',
      },
      {
        id: '3',
        type: 'shopify://apps/pandectes-gdpr/blocks/banner/y',
        name: 'Pandectes gdpr: Banner',
        enabled: true,
        ours: null,
      },
    ])
    expect(JSON.stringify(settings)).toBe(before)
  })

  it('reads nothing from settings without embeds', () => {
    expect(importedAppEmbeds({})).toEqual([])
    expect(importedAppEmbeds({ blocks: [] })).toEqual([])
  })
})
