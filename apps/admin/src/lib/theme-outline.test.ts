import { THEME_OUTLINE_LIMITS, ThemeOutlineSchema } from '@commerce/ai/client'
import type { TemplateSection } from '@commerce/core/theme'
import { describe, expect, it } from 'vitest'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'
import type { ImportedTheme } from './imported-sections'
import { buildThemeOutline, htmlToText, type OutlineSource } from './theme-outline'

const section = (type: string, props: Record<string, unknown>) =>
  ({ type, props }) as unknown as TemplateSection

const imported: ImportedTheme = {
  schemaLocale: { sections: { announcement: { name: 'Announcement bar' } } },
  blockSchemas: {},
  schemas: {
    'announcement-bar': {
      name: 't:sections.announcement.name',
      settings: [
        { type: 'checkbox', id: 'auto_rotate', label: 'Auto rotate', default: true },
        { type: 'range', id: 'speed', label: 'Speed', min: 3, max: 10, default: 5 },
        { type: 'color_scheme', id: 'color_scheme', label: 'Colours' },
        { type: 'header', content: 'Layout' },
        { type: 'text', id: 'id', label: 'Reserved id' },
      ],
      blocks: [
        {
          type: 'announcement',
          name: 'Announcement',
          settings: [
            { type: 'text', id: 'text', label: 'Text' },
            { type: 'url', id: 'link', label: 'Link' },
            { type: 'image_picker', id: 'icon', label: 'Icon' },
          ],
        },
      ],
    },
  },
}

const components: OutlineSource['components'] = {
  Hero: {
    label: 'Hero banner',
    fields: {
      heading: { type: 'text', label: 'Heading', contentEditable: true },
      body: { type: 'richtext', label: 'Text' },
      buttonUrl: { type: 'text', label: 'Button link' },
      height: { type: 'number', label: 'Height', min: 200, max: 900 },
      align: {
        type: 'select',
        label: 'Alignment',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Centre', value: 'center' },
        ],
      },
      fullWidth: {
        type: 'radio',
        label: 'Full width',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
      },
      image: { type: 'object', label: 'Image', objectFields: {} },
      items: { type: 'array', label: 'Items', arrayFields: {} },
    },
  },
}

const doc = (): CustomizeDoc => ({
  root: { props: {} },
  content: [
    section('Hero', {
      id: 'Hero-1',
      heading: 'Diwali sale',
      body: '<p>Up to <strong>40%</strong> off &amp; free gifts</p><p>Ends Sunday</p>',
      buttonUrl: '/collections/sale',
      height: 480,
      align: 'center',
      fullWidth: true,
      image: { url: 'x.png' },
      items: [],
    }),
  ],
  zones: {
    [HEADER_ZONE]: [
      section('LiquidSection', {
        id: 'LiquidSection-announcement',
        sectionType: 'announcement-bar',
        sectionKey: 'announcement',
        auto_rotate: false,
        setting_id: 'reserved value',
        blocks: [
          { id: 'a1', type: 'announcement', settings: { text: 'Free shipping', link: '' } },
          { type: 'announcement', settings: { text: 'Second' } },
        ],
      }),
    ],
    [FOOTER_ZONE]: [section('Footer', { id: 'Footer-1', _name: 'My footer' })],
  },
})

const source = (over: Partial<OutlineSource> = {}): OutlineSource => ({
  doc: doc(),
  components,
  imported,
  theme: { name: 'Dawn', published: true },
  templateLabel: 'Home page',
  selectedSectionId: null,
  ...over,
})

describe('buildThemeOutline', () => {
  it('lists sections in page order: header, page, footer', () => {
    const outline = buildThemeOutline(source())
    expect(outline.sections.map((s) => [s.zone, s.id, s.label])).toEqual([
      ['header', 'LiquidSection-announcement', 'Announcement bar'],
      ['main', 'Hero-1', 'Hero banner'],
      ['footer', 'Footer-1', 'My footer'],
    ])
    expect(outline).toMatchObject({
      themeName: 'Dawn',
      templateLabel: 'Home page',
      published: true,
    })
    expect(ThemeOutlineSchema.safeParse(outline).success).toBe(true)
  })

  it('reads an imported section from its schema, with its blocks and their settings', () => {
    const [bar] = buildThemeOutline(source()).sections
    expect(bar?.settings).toEqual([
      { key: 'auto_rotate', label: 'Auto rotate', kind: 'checkbox', value: false },
      { key: 'speed', label: 'Speed', kind: 'number', value: 5, min: 3, max: 10 },
      // A setting whose id is reserved is stored under `setting_<id>`.
      { key: 'setting_id', label: 'Reserved id', kind: 'text', value: 'reserved value' },
    ])
    expect(bar?.blocks).toEqual([
      {
        id: 'a1',
        type: 'announcement',
        label: 'Announcement',
        settings: [
          { key: 'text', label: 'Text', kind: 'text', value: 'Free shipping' },
          { key: 'link', label: 'Link', kind: 'url', value: '' },
        ],
      },
      {
        id: 'block_1',
        type: 'announcement',
        label: 'Announcement',
        settings: [
          { key: 'text', label: 'Text', kind: 'text', value: 'Second' },
          { key: 'link', label: 'Link', kind: 'url', value: '' },
        ],
      },
    ])
  })

  it('reads our own sections from their Puck fields, simple settings only', () => {
    const hero = buildThemeOutline(source()).sections[1]
    expect(hero?.settings).toEqual([
      { key: 'heading', label: 'Heading', kind: 'text', value: 'Diwali sale' },
      {
        key: 'body',
        label: 'Text',
        kind: 'richtext',
        value: 'Up to 40% off & free gifts\nEnds Sunday',
      },
      { key: 'buttonUrl', label: 'Button link', kind: 'url', value: '/collections/sale' },
      { key: 'height', label: 'Height', kind: 'number', value: 480, min: 200, max: 900 },
      {
        key: 'align',
        label: 'Alignment',
        kind: 'select',
        value: 'center',
        options: ['left', 'center'],
      },
      { key: 'fullWidth', label: 'Full width', kind: 'checkbox', value: true },
    ])
    expect(hero?.blocks).toEqual([])
  })

  it('keeps the selected section id only when it is a listed section', () => {
    expect(buildThemeOutline(source({ selectedSectionId: 'Hero-1' })).selectedSectionId).toBe(
      'Hero-1',
    )
    expect(buildThemeOutline(source({ selectedSectionId: 'nested-child' })).selectedSectionId).toBe(
      null,
    )
  })

  it('cuts long values and fits the whole outline to its size cap', () => {
    const long = doc()
    const hero = long.content[0] as TemplateSection
    ;(hero.props as Record<string, unknown>).heading = 'word '.repeat(200)
    const cut = buildThemeOutline(source({ doc: long })).sections[1]?.settings[0]
    expect(cut?.truncated).toBe(true)
    expect(String(cut?.value)).toHaveLength(THEME_OUTLINE_LIMITS.maxValue)

    const many = doc()
    many.content = Array.from({ length: 120 }, (_, i) =>
      section('Hero', { id: `Hero-${i}`, heading: 'h'.repeat(180), body: 'b'.repeat(180) }),
    )
    const outline = buildThemeOutline(source({ doc: many, selectedSectionId: 'Hero-110' }))
    expect(JSON.stringify(outline).length).toBeLessThanOrEqual(THEME_OUTLINE_LIMITS.maxSize)
    expect(outline.partial).toBe(true)
    expect(outline.sections.length).toBeLessThanOrEqual(THEME_OUTLINE_LIMITS.maxSections)
    // The selected section stays even past the section cap.
    expect(outline.sections.some((s) => s.id === 'Hero-110')).toBe(true)
    expect(ThemeOutlineSchema.safeParse(outline).success).toBe(true)
  })

  it('labels an imported section by its file name when the schema is unknown', () => {
    const outline = buildThemeOutline(source({ imported: null }))
    expect(outline.sections[0]).toMatchObject({ label: 'announcement-bar', settings: [] })
  })
})

describe('htmlToText', () => {
  it('turns body copy into plain lines', () => {
    expect(htmlToText('<p>A &amp; B</p><p>C<br>D</p>')).toBe('A & B\nC\nD')
  })
})
