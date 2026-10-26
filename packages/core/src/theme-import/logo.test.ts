/** SOURCE OF TRUTH: liquidThemeLogoUrl tests — WHAT: which imported-theme image setting becomes the chat logo / WHY: a plain `logo` must win over variants and `shopify://` values must be skipped */

import { describe, expect, it } from 'vitest'
import { liquidThemeLogoUrl } from './logo'

const schema = (settings: { type: string; id: string }[]) => ({ source: '', schema: { settings } })

const bundle = (over: Partial<Parameters<typeof liquidThemeLogoUrl>[1]> = {}) => ({
  sections: new Map([
    [
      'header',
      schema([
        { type: 'image_picker', id: 'logo_transparent' },
        { type: 'image_picker', id: 'logo' },
        { type: 'text', id: 'logo_text' },
      ]),
    ],
  ]),
  settings: {},
  settingsSchema: [],
  ...over,
})

describe('liquidThemeLogoUrl', () => {
  it("reads the header section's logo, preferring the plain one over variants", () => {
    const header = [
      {
        type: 'LiquidSection',
        props: {
          sectionType: 'header',
          logo_transparent: { url: 'https://cdn.x/white.png' },
          logo: { url: 'https://cdn.x/logo.png', alt: '' },
          logo_text: 'https://cdn.x/not-an-image.png',
        },
      },
    ]
    expect(liquidThemeLogoUrl(header, bundle())).toBe('https://cdn.x/logo.png')
  })

  it('falls back to the theme settings, and skips shopify:// references', () => {
    const header = [
      {
        type: 'LiquidSection',
        props: { sectionType: 'header', logo: 'shopify://shop_images/a.png' },
      },
    ]
    const b = bundle({
      settings: { logo: '/media/store/logo.svg' },
      settingsSchema: [{ name: 'Logo', settings: [{ type: 'image_picker', id: 'logo' }] }],
    })
    expect(liquidThemeLogoUrl(header, b)).toBe('/media/store/logo.svg')
  })

  it('is null without any logo', () => {
    expect(liquidThemeLogoUrl([], bundle())).toBeNull()
  })
})
