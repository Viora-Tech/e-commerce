import type { ThemeSettingsGroup } from '@commerce/core/theme-import'
import { describe, expect, it } from 'vitest'
import {
  changedSettings,
  fontChoices,
  importedGroupIcon,
  importedGroupSummary,
  swatchHex,
} from './imported-theme-settings'

const copy = {
  empty: 'Nothing set',
  schemes: (n: number) => `${n} colour schemes`,
}

const LOCALE = { settings_schema: { favicon: { label: 'Favicon image' } } }

const LOGO: ThemeSettingsGroup = {
  key: '1',
  name: 'Logo',
  settings: [
    { type: 'header', content: 'Logo' },
    { type: 'image_picker', id: 'logo', label: 'Logo' },
    { type: 'range', id: 'logo_width', label: 'Width', min: 50, max: 300, unit: 'px', default: 90 },
    { type: 'image_picker', id: 'favicon', label: 't:settings_schema.favicon.label' },
  ],
}

const TYPE: ThemeSettingsGroup = {
  key: '2',
  name: 'Typography',
  settings: [
    { type: 'font_picker', id: 'type_header_font', label: 'Headings', default: 'assistant_n4' },
    {
      type: 'select',
      id: 'type_scale',
      label: 'Scale',
      default: 'm',
      options: [
        { value: 's', label: 'Small' },
        { value: 'm', label: 'Medium' },
      ],
    },
    { type: 'checkbox', id: 'uppercase', label: 'Uppercase headings' },
    { type: 'color', id: 'heading_colour', label: 'Colour' },
  ],
}

describe('importedGroupSummary', () => {
  it('names what the first settings are set to, defaults included', () => {
    expect(
      importedGroupSummary(
        LOGO,
        { logo: { url: '', alt: '' }, favicon: { url: 'https://media.test/f.png' } },
        LOCALE,
        copy,
      ),
    ).toBe('Width 90px · Favicon image')
  })

  it('reads fonts, choices, switches and colours', () => {
    expect(importedGroupSummary(TYPE, { uppercase: true, heading_colour: '#abc' }, {}, copy)).toBe(
      'Assistant · Medium · Uppercase headings',
    )
    expect(
      importedGroupSummary(
        TYPE,
        { type_header_font: 'dm_sans_n7', type_scale: 'x', heading_colour: '#abc' },
        {},
        copy,
      ),
    ).toBe('DM Sans · #AABBCC')
  })

  it('says nothing is set when no setting has a value worth naming', () => {
    const group: ThemeSettingsGroup = {
      key: '3',
      name: 'Social',
      settings: [{ type: 'text', id: 'social_instagram', label: 'Instagram' }],
    }
    expect(importedGroupSummary(group, { social_instagram: '  ' }, {}, copy)).toBe('Nothing set')
    expect(
      importedGroupSummary(
        { key: '4', name: 'Colors', settings: [{ type: 'color_scheme_group', id: 'cs' }] },
        { cs: { 'scheme-1': {}, 'scheme-2': {} } },
        {},
        copy,
      ),
    ).toBe('2 colour schemes')
  })
})

describe('Theme settings helpers', () => {
  it('picks an icon by the group name', () => {
    expect(importedGroupIcon('Logo')).toBe('brand')
    expect(importedGroupIcon('Colors')).toBe('colours')
    expect(importedGroupIcon('Social media')).toBe('social')
    expect(importedGroupIcon('Animations')).toBe('other')
  })

  it('offers the store fonts in the same weight, the current one first', () => {
    const choices = fontChoices('assistant_n7')
    expect(choices[0]).toEqual({ label: 'Assistant', value: 'assistant_n7' })
    expect(choices).toContainEqual({ label: 'DM Sans', value: 'dm_sans_n7' })
    expect(fontChoices('inter_n4')[0]?.value).not.toBe('assistant_n7')
  })

  it('turns colours into swatch values', () => {
    expect(swatchHex('#abc')).toBe('#AABBCC')
    expect(swatchHex('#12345678')).toBe('#123456')
    expect(swatchHex('rgba(0,0,0,0)')).toBeNull()
  })

  it('sends only what changed, a removed value as null', () => {
    expect(
      changedSettings({ a: 1, b: { url: 'x' }, c: true }, { a: 1, b: { url: 'y' }, d: 'new' }),
    ).toEqual({ b: { url: 'y' }, c: null, d: 'new' })
  })
})
