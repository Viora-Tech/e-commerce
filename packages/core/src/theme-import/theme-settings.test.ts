/** SOURCE OF TRUTH: Theme settings of imported themes, pure half — the groups Customize lists from `settings_schema.json`, what a save may store per setting type, Shopify font handles, and the favicon read from a rendered head */
import { describe, expect, it } from 'vitest'
import { headFavicon } from './render'
import type { ShopifySetting } from './schema'
import {
  cleanThemeSetting,
  cleanThemeSettings,
  fontFamilyKey,
  fontFamilyLabel,
  fontHandleFamily,
  themeSettingsById,
  themeSettingsGroups,
  withFontFamily,
} from './theme-settings'

const SCHEMA = [
  { name: 'theme_info', theme_name: 'Dawn' } as { name: string },
  {
    name: 't:settings_schema.logo.name',
    settings: [
      { type: 'image_picker', id: 'logo', label: 'Logo' },
      { type: 'range', id: 'logo_width', min: 50, max: 300, step: 10, unit: 'px', label: 'Width' },
      { type: 'image_picker', id: 'favicon', label: 'Favicon' },
    ],
  },
  { name: 'Notes', settings: [{ type: 'paragraph', content: 'Only words here' }] },
  {
    name: 'Cart',
    settings: [
      { type: 'header', content: 'Cart' },
      {
        type: 'select',
        id: 'cart_type',
        label: 'Cart type',
        options: [
          { value: 'drawer', label: 'Drawer' },
          { value: 'page', label: 'Page' },
        ],
      },
      { type: 'checkbox', id: 'show_vendor', label: 'Show vendor' },
    ],
  },
]

const LOCALE = { settings_schema: { logo: { name: 'Logo' } } }

describe('themeSettingsGroups', () => {
  it('lists the groups with something to set, names read through the schema locale', () => {
    const groups = themeSettingsGroups(SCHEMA, LOCALE)
    expect(groups.map((g) => g.name)).toEqual(['Logo', 'Cart'])
    expect(groups[0]?.settings.map((s) => s.id)).toEqual(['logo', 'logo_width', 'favicon'])
    // Keys stay put when groups before them are left out.
    expect(groups.map((g) => g.key)).toEqual(['1', '3'])
  })

  it('indexes every value setting by id', () => {
    expect([...themeSettingsById(SCHEMA).keys()]).toEqual([
      'logo',
      'logo_width',
      'favicon',
      'cart_type',
      'show_vendor',
    ])
  })
})

describe('cleanThemeSettings', () => {
  const schema = [...themeSettingsById(SCHEMA).values()]

  it('keeps only settings the schema declares, each of the right kind', () => {
    const out = cleanThemeSettings(schema, {
      favicon: { url: 'https://media.test/fav.png', alt: 'Icon', width: 64, height: 64 },
      logo_width: 999,
      cart_type: 'popup',
      show_vendor: 'yes',
      not_in_schema: 'x',
    })
    expect(out).toEqual({
      favicon: { url: 'https://media.test/fav.png', alt: 'Icon', width: 64, height: 64 },
      // Clamped to the range.
      logo_width: 300,
    })
  })

  it('takes a removed picture as empty and refuses addresses a theme could break out of', () => {
    const image: ShopifySetting = { type: 'image_picker', id: 'favicon' }
    expect(cleanThemeSetting(image, null)).toEqual({ url: '', alt: '' })
    expect(cleanThemeSetting(image, { url: 'javascript:alert(1)' })).toBeUndefined()
    expect(cleanThemeSetting(image, { url: 'https://a.test/x.png" onload="x' })).toBeUndefined()
    expect(cleanThemeSetting(image, { url: '/files/x.png', focal: { x: 120, y: 30 } })).toEqual({
      url: '/files/x.png',
      alt: '',
      focal: { x: 100, y: 30 },
    })
  })

  it('cleans colours, fonts, links and colour schemes', () => {
    expect(cleanThemeSetting({ type: 'color', id: 'c' }, '#12AB34')).toBe('#12AB34')
    expect(cleanThemeSetting({ type: 'color', id: 'c' }, 'red;}')).toBeUndefined()
    expect(cleanThemeSetting({ type: 'font_picker', id: 'f' }, 'dm_sans_n4')).toBe('dm_sans_n4')
    expect(cleanThemeSetting({ type: 'font_picker', id: 'f' }, 'Inter, sans')).toBeUndefined()
    expect(cleanThemeSetting({ type: 'url', id: 'u' }, 'shopify://collections/all')).toBe(
      'shopify://collections/all',
    )
    expect(cleanThemeSetting({ type: 'url', id: 'u' }, 'javascript:x')).toBeUndefined()
    const schemes: ShopifySetting = {
      type: 'color_scheme_group',
      id: 'color_schemes',
      definition: [
        { type: 'color', id: 'background', label: 'Background' },
        { type: 'color', id: 'text', label: 'Text' },
      ],
    }
    expect(
      cleanThemeSetting(schemes, {
        'scheme-1': { settings: { background: '#FFFFFF', text: 'nope', extra: '#000' } },
        'bad id!': { settings: { background: '#000000' } },
      }),
    ).toEqual({ 'scheme-1': { settings: { background: '#FFFFFF' } } })
  })
})

describe('font handles', () => {
  it('swaps the family and keeps the weight and style', () => {
    expect(fontHandleFamily('assistant_n7')).toBe('assistant')
    expect(fontFamilyKey('Plus Jakarta Sans')).toBe('plus_jakarta_sans')
    expect(fontFamilyLabel('plus_jakarta_sans')).toBe('Plus Jakarta Sans')
    expect(withFontFamily('assistant_i7', 'lora')).toBe('lora_i7')
    expect(withFontFamily('', 'lora')).toBe('lora_n4')
  })
})

describe('headFavicon', () => {
  it('reads the first icon link of the rendered head', () => {
    const head = `<link rel="preconnect" href="https://cdn.test">
<link rel="shortcut icon" type="image/png" href="https://media.test/fav.png?width=32&amp;height=32">
<link rel="icon" href="/second.png">`
    expect(headFavicon(head)).toBe('https://media.test/fav.png?width=32&height=32')
  })

  it('ignores icons without a usable address', () => {
    expect(headFavicon('<link rel="icon" href="javascript:alert(1)">')).toBeNull()
    expect(headFavicon('<link rel="stylesheet" href="/a.css">')).toBeNull()
  })
})
