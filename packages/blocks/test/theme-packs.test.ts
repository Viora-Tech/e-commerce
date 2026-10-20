import { describe, expect, it } from 'vitest'
import {
  createBlocksConfig,
  hiddenPackSections,
  SECTION_CATEGORIES,
  sectionCategories,
  ZERO_DRIFT_PACK,
  ZERO_DRIFT_PRODUCT_SECTIONS,
  ZERO_DRIFT_SECTIONS,
} from '../src/puck-config'

const OUR_GROUPS = ['banners', 'text', 'products', 'media', 'more', 'layout', 'elements']
const zeroDriftTypes = [...ZERO_DRIFT_SECTIONS, ...ZERO_DRIFT_PRODUCT_SECTIONS] as string[]

describe('sectionCategories', () => {
  it('offers only our own groups, with no Zero Drift section, to a store without the pack', () => {
    const categories = sectionCategories()
    expect(Object.keys(categories)).toEqual(OUR_GROUPS)
    const offered = Object.values(categories).flatMap((c) => c?.components ?? [])
    for (const type of zeroDriftTypes) expect(offered, type).not.toContain(type)
    expect(categories.products?.components).toContain('FeaturedProducts')
  })

  it('adds the Zero Drift group after our own groups once the pack is on', () => {
    const categories = sectionCategories([ZERO_DRIFT_PACK])
    expect(Object.keys(categories)).toEqual([...OUR_GROUPS, 'zeroDrift'])
    expect(categories.zeroDrift?.components).toEqual(ZERO_DRIFT_SECTIONS)
    for (const type of ZERO_DRIFT_PRODUCT_SECTIONS)
      expect(categories.products?.components).toContain(type)
  })

  it('ignores packs it does not know', () => {
    expect(sectionCategories(['nope'])).toEqual(sectionCategories())
  })

  it('names every pack section as hidden until its pack is on', () => {
    expect([...hiddenPackSections()].sort()).toEqual([...zeroDriftTypes].sort())
    expect(hiddenPackSections([ZERO_DRIFT_PACK]).size).toBe(0)
  })
})

describe('createBlocksConfig and theme packs', () => {
  it('keeps every Zero Drift section registered, so saved pages render for any store', () => {
    const config = createBlocksConfig(async () => [])
    for (const type of zeroDriftTypes)
      expect(config.components[type as keyof typeof config.components], type).toBeTruthy()
  })

  it("lists the pack's group only for a store that turned it on, after ours", () => {
    const off = Object.keys(createBlocksConfig(async () => []).categories ?? {})
    expect(off).not.toContain('zeroDrift')
    expect(off.slice(0, OUR_GROUPS.length)).toEqual(OUR_GROUPS)
    const on = Object.keys(
      createBlocksConfig(async () => [], { themePacks: [ZERO_DRIFT_PACK] }).categories ?? {},
    )
    expect(on.indexOf('zeroDrift')).toBeGreaterThan(on.indexOf('elements'))
  })

  it('still catalogues every section in SECTION_CATEGORIES, our groups first', () => {
    expect(Object.keys(SECTION_CATEGORIES)).toEqual([...OUR_GROUPS, 'zeroDrift'])
  })
})
