import { describe, expect, it } from 'vitest'
import { createBlocksConfig } from '../src/puck-config'
import { presetPictureKey, presetProps, presetsFor, SECTION_PRESETS } from '../src/section-presets'

const config = createBlocksConfig(async () => [])
const defaultsOf = (type: string) =>
  ((config.components as Record<string, { defaultProps?: Record<string, unknown> }>)[type]
    ?.defaultProps ?? {}) as Record<string, unknown>

describe('section presets', () => {
  it('only names sections the editor has, and each style once', () => {
    for (const [type, presets] of Object.entries(SECTION_PRESETS)) {
      expect(config.components).toHaveProperty(type)
      expect(new Set(presets.map((p) => p.id)).size).toBe(presets.length)
      for (const p of presets) expect(p.label).not.toBe('')
    }
  })

  it('starts each section with its plain defaults as the first style', () => {
    for (const [type, presets] of Object.entries(SECTION_PRESETS)) {
      const first = presets[0]
      if (!first) continue
      const defaults = defaultsOf(type)
      const styled = presetProps(type, first.id, defaults)
      // Same keys as the defaults: a style changes values, never the section's shape.
      expect(Object.keys(styled).sort()).toEqual(Object.keys(defaults).sort())
    }
  })

  it('gives the hero one slide in the chosen layout and turns the slideshow off', () => {
    const defaults = defaultsOf('Hero')
    const split = presetProps('Hero', 'split', defaults)
    const slides = split.slides as Record<string, unknown>[]
    expect(slides).toHaveLength(1)
    expect(slides[0]).toMatchObject({ layout: 'split', splitMediaPosition: 'right' })
    expect(split).toMatchObject({ autoplay: false, showDots: false, showArrows: false })
    expect(
      (presetProps('Hero', 'centred', defaults).slides as { textPosition: string }[])[0],
    ).toMatchObject({ textPosition: 'center' })
    expect((presetProps('Hero', 'video', defaults).slides as { kind: string }[])[0]?.kind).toBe(
      'video',
    )
  })

  it('lays feature cards out 4 across with four cards, or without icons', () => {
    const defaults = defaultsOf('FeatureCards')
    const four = presetProps('FeatureCards', 'four', defaults)
    expect(four.columns).toBe(4)
    expect(four.items).toHaveLength(4)
    const text = presetProps('FeatureCards', 'text', defaults)
    expect((text.items as { icon: string }[]).every((i) => i.icon === '')).toBe(true)
  })

  it('never changes the defaults it was given', () => {
    const defaults = defaultsOf('Hero')
    const before = JSON.stringify(defaults)
    presetProps('Hero', 'split', defaults)
    presetProps('FeatureCards', 'four', defaultsOf('FeatureCards'))
    expect(JSON.stringify(defaults)).toBe(before)
  })

  it('has no styles for other sections and reads an unknown style as the defaults', () => {
    expect(presetsFor('RichText')).toEqual([])
    expect(presetProps('ImageBanner', 'nope', { align: 'left' })).toEqual({ align: 'left' })
    expect(presetPictureKey('Hero', 'split')).toBe('Hero--split')
  })
})
