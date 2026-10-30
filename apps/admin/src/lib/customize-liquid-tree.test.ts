import type { ShopifySectionSchema } from '@commerce/core/theme-import'
import { describe, expect, it } from 'vitest'
import {
  liquidBlockRows,
  liquidBlockTypes,
  liquidCanAddBlock,
  withLiquidBlockAdded,
  withLiquidBlockDuplicated,
  withLiquidBlockRemoved,
  withLiquidBlocksOrdered,
  withLiquidBlockToggled,
} from './customize-liquid-tree'
import type { ImportedTheme } from './imported-sections'

const schema = {
  name: 'Hero carousel',
  max_blocks: 3,
  blocks: [
    {
      type: 'slide',
      name: 'Image slide',
      settings: [{ type: 'text', id: 'heading', label: 'Heading', default: 'New slide' }],
    },
    { type: 'video', name: 'Video slide', settings: [] },
    { type: '@app' },
  ],
} as unknown as ShopifySectionSchema

const theme: ImportedTheme = { schemas: { hero: schema }, blockSchemas: {}, schemaLocale: {} }

const props = {
  sectionType: 'hero',
  blocks: [
    { id: 'a', type: 'slide', settings: { heading: '<b>Victory</b> Season Sale' } },
    { id: 'b', type: 'video', settings: {}, disabled: true },
  ],
}

describe('imported section blocks in Layers', () => {
  it('lists blocks by their own text, then their type, and keeps hidden ones', () => {
    const types = liquidBlockTypes(schema, theme)
    expect(types.map((t) => t.type)).toEqual(['slide', 'video'])
    expect(liquidBlockRows(props, types)).toEqual([
      {
        index: 0,
        id: 'a',
        type: 'slide',
        title: 'Victory Season Sale',
        typeName: 'Image slide',
        hidden: false,
      },
      { index: 1, id: 'b', type: 'video', title: 'Video slide', typeName: null, hidden: true },
    ])
  })

  it('names a block by any text it carries when it has no heading (audit #126)', () => {
    const types = liquidBlockTypes(schema, theme)
    const rows = liquidBlockRows(
      {
        ...props,
        blocks: [
          {
            id: 'v',
            type: 'video',
            settings: {
              video: 'shopify://files/videos/hyzen.mp4',
              overlay: '#000000',
              slide_caption_text: 'Lofree Hyzen',
            },
          },
        ],
      },
      types,
    )
    expect(rows[0]).toMatchObject({ title: 'Lofree Hyzen', typeName: 'Video slide' })
  })

  it('adds a block from its schema defaults, up to max_blocks', () => {
    const next = withLiquidBlockAdded(props, 'slide', schema, theme)
    const added = (next.blocks as { id: string; type: string; settings: unknown }[])[2]
    expect(added?.type).toBe('slide')
    expect(added?.settings).toEqual({ heading: 'New slide' })
    expect(added?.id).not.toBe('a')
    expect(liquidCanAddBlock(props, schema)).toBe(true)
    expect(liquidCanAddBlock(next, schema)).toBe(false)
  })

  it('hides, shows, duplicates, reorders and removes', () => {
    const shown = withLiquidBlockToggled(props, 1)
    expect((shown.blocks as { disabled?: boolean }[])[1]?.disabled).toBeUndefined()
    const dup = withLiquidBlockDuplicated(props, 0).blocks as { id: string; settings: unknown }[]
    expect(dup).toHaveLength(3)
    expect(dup[1]?.settings).toEqual(dup[0]?.settings)
    expect(dup[1]?.id).not.toBe('a')
    const ordered = withLiquidBlocksOrdered(props, ['b', 'a']).blocks as { id: string }[]
    expect(ordered.map((b) => b.id)).toEqual(['b', 'a'])
    expect(withLiquidBlocksOrdered(props, ['b'])).toBe(props)
    expect((withLiquidBlockRemoved(props, 0).blocks as { id: string }[]).map((b) => b.id)).toEqual([
      'b',
    ])
  })
})
