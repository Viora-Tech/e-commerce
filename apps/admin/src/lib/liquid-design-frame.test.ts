import { describe, expect, it } from 'vitest'
import { type CustomizeDoc, FOOTER_ZONE, HEADER_ZONE } from './customize-doc'
import {
  designFramePath,
  designFrameSelection,
  designFrameZones,
  puckIdForSection,
} from './liquid-design-frame'

const liquid = (key: string, type = 'hero') => ({
  type: 'LiquidSection',
  props: { id: `LiquidSection-${key}`, sectionKey: key, sectionType: type, blocks: [] },
})

const doc = {
  root: { props: {} },
  content: [liquid('hero'), { type: 'RichText', props: { id: 'ours' } }, liquid('faq', 'faq')],
  zones: { [HEADER_ZONE]: [liquid('header', 'header')], [FOOTER_ZONE]: [] },
} as unknown as CustomizeDoc

describe('the Theme scripts frame state', () => {
  it('lists imported sections by group with Shopify section ids, ours left out', () => {
    const zones = designFrameZones(doc, {})
    expect(Object.keys(zones)).toEqual(['header-group', 'template', 'footer-group'])
    expect(zones.template?.map((s) => s.id)).toEqual([
      expect.stringMatching(/^template--\d+__hero$/),
      expect.stringMatching(/^template--\d+__faq$/),
    ])
    expect(zones['header-group']?.[0]?.id).toMatch(/^sections--\d+__header$/)
  })

  it('maps the selection and a click between Puck ids and section ids', () => {
    const sel = designFrameSelection(doc, {}, 'LiquidSection-faq', null)
    expect(sel?.sectionId).toMatch(/__faq$/)
    expect(sel?.blockId).toBeNull()
    const focused = designFrameSelection(doc, {}, null, {
      sectionId: 'LiquidSection-hero',
      blockId: 'slide_1',
    })
    expect(focused?.blockId).toBe('slide_1')
    expect(designFrameSelection(doc, {}, 'ours', null)).toBeNull()
    expect(puckIdForSection(doc, {}, sel?.sectionId ?? '')).toBe('LiquidSection-faq')
    expect(puckIdForSection(doc, {}, 'nope')).toBeNull()
  })

  it('opens the home page or the chosen product, nothing it cannot match', () => {
    expect(designFramePath('home', '', null)).toBe('/')
    expect(designFramePath('product', '', { kind: 'product', product: { handle: 'mat' } })).toBe(
      '/products/mat',
    )
    expect(
      designFramePath('product', 'alt', { kind: 'product', product: { handle: 'mat' } }),
    ).toBeNull()
    expect(designFramePath('collection', '', null)).toBeNull()
  })
})
