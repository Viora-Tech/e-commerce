import type { ThemeEditChange } from '@commerce/ai/client'
import type { TemplateSection } from '@commerce/core/theme'
import { describe, expect, it } from 'vitest'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'
import { applyThemeEdits, storedValue, textToHtml, withChange } from './theme-edit-apply'

const section = (type: string, props: Record<string, unknown>) =>
  ({ type, props }) as unknown as TemplateSection

const doc = (): CustomizeDoc => ({
  root: { props: { title: 'Home' } },
  content: [section('Hero', { id: 'Hero-1', heading: 'Old', body: '<p>Old</p>' })],
  zones: {
    [HEADER_ZONE]: [
      section('LiquidSection', {
        id: 'LiquidSection-announcement',
        sectionType: 'announcement-bar',
        auto_rotate: false,
        blocks: [
          { id: 'a1', type: 'announcement', settings: { text: 'Free shipping', link: '' } },
          {
            id: 'tabs',
            type: 'group',
            settings: {},
            blocks: [{ id: 'inner', type: 'text', settings: { text: 'Nested' } }],
          },
          { type: 'announcement', settings: { text: 'No id' } },
        ],
      }),
    ],
    [FOOTER_ZONE]: [section('Footer', { id: 'Footer-1', copyright: '© Old' })],
  },
})

const change = (over: Partial<ThemeEditChange>): ThemeEditChange => ({
  sectionId: 'Hero-1',
  blockId: null,
  setting: 'heading',
  kind: 'text',
  value: 'New',
  before: 'Old',
  sectionLabel: 'Hero',
  blockLabel: null,
  settingLabel: 'Heading',
  ...over,
})

const bar = (d: CustomizeDoc) => d.zones[HEADER_ZONE]?.[0]?.props as Record<string, unknown>

describe('applyThemeEdits', () => {
  it('sets a section prop, and leaves the input document untouched', () => {
    const before = doc()
    const snapshot = JSON.stringify(before)
    const { doc: next, applied, missing } = applyThemeEdits(before, [change({})])
    expect(applied).toBe(1)
    expect(missing).toEqual([])
    expect(next.content[0]?.props).toMatchObject({ id: 'Hero-1', heading: 'New' })
    expect(JSON.stringify(before)).toBe(snapshot)
    // Untouched sections keep their identity, so Puck re-renders only what changed.
    expect(next.zones[FOOTER_ZONE]?.[0]).toBe(before.zones[FOOTER_ZONE]?.[0])
    expect(next.root).toBe(before.root)
  })

  it("edits an imported section's top-level setting and a block's settings", () => {
    const { doc: next } = applyThemeEdits(doc(), [
      change({
        sectionId: 'LiquidSection-announcement',
        setting: 'auto_rotate',
        kind: 'checkbox',
        value: true,
      }),
      change({
        sectionId: 'LiquidSection-announcement',
        blockId: 'a1',
        setting: 'text',
        value: 'Diwali sale',
      }),
      change({
        sectionId: 'LiquidSection-announcement',
        blockId: 'inner',
        setting: 'text',
        value: 'Deep',
      }),
      change({
        sectionId: 'LiquidSection-announcement',
        blockId: 'block_2',
        setting: 'text',
        value: 'By place',
      }),
    ])
    const props = bar(next)
    expect(props.auto_rotate).toBe(true)
    const blocks = props.blocks as {
      settings: Record<string, unknown>
      blocks?: { settings: Record<string, unknown> }[]
    }[]
    expect(blocks[0]?.settings).toEqual({ text: 'Diwali sale', link: '' })
    expect(blocks[1]?.blocks?.[0]?.settings).toEqual({ text: 'Deep' })
    expect(blocks[2]?.settings).toEqual({ text: 'By place' })
  })

  it('stores body copy as HTML paragraphs, escaped', () => {
    const { doc: next } = applyThemeEdits(doc(), [
      change({ setting: 'body', kind: 'richtext', value: 'Line <one> & more\nnext\n\nSecond' }),
    ])
    expect(next.content[0]?.props).toMatchObject({
      body: '<p>Line &lt;one&gt; &amp; more<br>next</p><p>Second</p>',
    })
    expect(storedValue({ kind: 'text', value: '<b>raw</b>' })).toBe('<b>raw</b>')
    expect(textToHtml('')).toBe('')
  })

  it('reports changes whose section or block is gone, and applies the rest', () => {
    const result = applyThemeEdits(doc(), [
      change({ sectionId: 'Removed-1' }),
      change({ sectionId: 'LiquidSection-announcement', blockId: 'gone', setting: 'text' }),
      change({ sectionId: 'Footer-1', setting: 'copyright', value: '© 2026 Glide' }),
    ])
    expect(result.applied).toBe(1)
    expect(result.missing.map((m) => m.sectionId)).toEqual([
      'LiquidSection-announcement',
      'Removed-1',
    ])
    expect(result.doc.zones[FOOTER_ZONE]?.[0]?.props).toMatchObject({ copyright: '© 2026 Glide' })
  })
})

describe('withChange', () => {
  it('sets a picture as { url, alt }, keeping alt and dropping the old focal point', () => {
    const before = { image: { url: '/old.jpg', alt: 'Pad', focal: { x: 0.2, y: 0.4 } } }
    const after = withChange(before, { setting: 'image', kind: 'image', value: '/new.jpg' })
    expect(after.image).toEqual({ url: '/new.jpg', alt: 'Pad' })
  })

  it('turns an imported string picture into { url, alt }', () => {
    const after = withChange(
      { image: 'shopify://shop_images/a.jpg' },
      { setting: 'image', kind: 'image', value: 'https://cdn.example.com/b.jpg' },
    )
    expect(after.image).toEqual({ url: 'https://cdn.example.com/b.jpg', alt: '' })
  })

  it('writes button.href into the button object and keeps its label', () => {
    const after = withChange(
      { button: { label: 'Shop now', href: '/collections/all' } },
      { setting: 'button.href', kind: 'url', value: '/products/maki' },
    )
    expect(after.button).toEqual({ label: 'Shop now', href: '/products/maki' })
  })
})
