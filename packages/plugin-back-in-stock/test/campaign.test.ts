import { describe, expect, it } from 'vitest'
import {
  BackInStockStoreSettingsSchema,
  campaignShowsOn,
  DEFAULT_NOTIFY_BUTTON_TEXT,
  describeProduct,
  notifyWidgetOf,
  POPUP_DEFAULTS,
} from '../src/settings-schema'

const P = '00000000-0000-4000-8000-000000000001'
const C = '00000000-0000-4000-8000-000000000002'
const OTHER = '00000000-0000-4000-8000-000000000003'

describe('campaign settings', () => {
  it('a stored row from before the campaign fields parses to the old behaviour', () => {
    const s = BackInStockStoreSettingsSchema.parse({ emailEnabled: true, buttonText: '' })
    expect(s.enabled).toBe(true)
    expect(s.doubleOptIn).toBe(true)
    expect(s.showOn).toBe('all')
    expect(s.buttonStyle).toBe('theme')
  })

  it('rejects a colour that is not #rrggbb', () => {
    expect(BackInStockStoreSettingsSchema.safeParse({ buttonBackground: 'red' }).success).toBe(
      false,
    )
  })

  it('shows on every product, chosen products or products in chosen collections', () => {
    const base = BackInStockStoreSettingsSchema.parse({})
    expect(campaignShowsOn(base, P, [])).toBe(true)
    expect(campaignShowsOn({ ...base, enabled: false }, P, [])).toBe(false)
    const byProduct = { ...base, showOn: 'products' as const, productIds: [P] }
    expect(campaignShowsOn(byProduct, P, [])).toBe(true)
    expect(campaignShowsOn(byProduct, OTHER, [])).toBe(false)
    const byCollection = { ...base, showOn: 'collections' as const, collectionIds: [C] }
    expect(campaignShowsOn(byCollection, P, [C])).toBe(true)
    expect(campaignShowsOn(byCollection, P, [OTHER])).toBe(false)
  })

  it('the storefront widget fills empty words with the defaults', () => {
    const w = notifyWidgetOf(
      BackInStockStoreSettingsSchema.parse({ popupHeading: '  ', newsletter: 'ask' }),
    )
    expect(w.buttonText).toBe(DEFAULT_NOTIFY_BUTTON_TEXT)
    expect(w.popupHeading).toBe(POPUP_DEFAULTS.popupHeading)
    expect(w.newsletter).toBe(true)
  })

  it('fills {product} with the product and a real variant title', () => {
    expect(describeProduct('Want {product}?', 'Wooting 80HE+', 'Frost White')).toBe(
      'Want Wooting 80HE+ - Frost White?',
    )
    expect(describeProduct('Want {product}?', 'Glasspad', 'Default')).toBe('Want Glasspad?')
  })
})
