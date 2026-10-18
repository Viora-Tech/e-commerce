import { describe, expect, it } from 'vitest'
import {
  createBlocksConfig,
  ZERO_DRIFT_PRODUCT_SECTIONS,
  ZERO_DRIFT_SECTIONS,
} from '../src/puck-config'

/**
 * Saved templates and "My sections" store each section's `type`. The theme was renamed from
 * Glide to Zero Drift in code only: these type names never carried the old name and must not
 * change, or saved pages would stop loading. Changing this list needs a data migration.
 */
describe('Zero Drift section types stay as saved templates know them', () => {
  it('keeps every home and content section type', () => {
    expect([...ZERO_DRIFT_SECTIONS]).toEqual([
      'ShipsToday',
      'CategoryPanels',
      'FeaturedCarousel',
      'ReviewsShowcase',
      'PromoBento',
      'LatestDrop',
      'DropsTeaser',
      'PerfectMatch',
      'BrandLab',
      'LogoCarousel',
      'DropReveal',
      'NotesSeries',
      'SocialWall',
      'DiscordCta',
      'Reviews',
      'ImageComparison',
      'MobileDock',
      'SignupPopup',
      'WhatsappChat',
    ])
  })

  it('keeps every product page section type', () => {
    expect([...ZERO_DRIFT_PRODUCT_SECTIONS]).toEqual([
      'ProductSpecs',
      'ProductSizeGuide',
      'ProductSizeTable',
      'ProductTabs',
      'ProductSpecStrip',
      'ProductFeatures',
      'ProductReviews',
      'StickyAtc',
    ])
  })

  it('registers them all, and no type name carries the old theme name', () => {
    const config = createBlocksConfig(async () => [])
    for (const type of [...ZERO_DRIFT_SECTIONS, ...ZERO_DRIFT_PRODUCT_SECTIONS]) {
      expect(config.components[type], type).toBeTruthy()
    }
    expect(Object.keys(config.components).filter((type) => /glide/i.test(type))).toEqual([])
  })
})
