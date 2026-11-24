import { defaultLoyaltySettings } from '@commerce/core/loyalty'
import { describe, expect, it } from 'vitest'
import { customizeHref, LOYALTY_PLACEMENTS, placementStatus } from './loyalty-placements'
import {
  changedTiers,
  cleanEmails,
  multiplierText,
  newTierDraft,
  parseMultiplier,
  spendDraftOf,
  type TierDraft,
  thresholdFieldValue,
  thresholdFromField,
  tierInputOf,
} from './loyalty-program'

const tier = (over: Partial<TierDraft> = {}): TierDraft => ({
  key: 'a',
  id: 'a',
  name: 'Silver',
  threshold: 500,
  multiplierBp: 10_000,
  perks: [],
  rewardId: null,
  customerTag: '',
  colors: { background: '#000000', text: '#ffffff' },
  position: 0,
  ...over,
})

describe('loyalty program form', () => {
  it('reads the order spend rule, or falls back to the v1 rate', () => {
    expect(spendDraftOf([], { ...defaultLoyaltySettings, pointsPer100: 3 })).toEqual({
      id: null,
      points: 3,
      excludeProductTags: [],
      enabled: true,
    })
    const rule = {
      id: 'r1',
      type: 'order_spend',
      points: 2,
      enabled: false,
      settings: { excludeProductTags: ['gift-card', 7] },
    } as never
    expect(spendDraftOf([rule], defaultLoyaltySettings)).toEqual({
      id: 'r1',
      points: 2,
      excludeProductTags: ['gift-card'],
      enabled: false,
    })
  })

  it('starts a new tier above the highest one, a step faster', () => {
    expect(newTierDraft([], 'points', 'Bronze', 'k').threshold).toBe(0)
    const next = newTierDraft(
      [tier({ threshold: 800, multiplierBp: 12_500 })],
      'points',
      'Gold',
      'k',
    )
    expect(next).toMatchObject({ id: null, threshold: 1600, multiplierBp: 15_000, position: 1 })
    expect(newTierDraft([tier({ threshold: 0 })], 'spend', 'Gold', 'k').threshold).toBe(500_000)
  })

  it('finds new and changed tiers only', () => {
    const saved = [tier(), tier({ key: 'b', id: 'b', name: 'Gold' })]
    const draft = [tier(), tier({ key: 'b', id: 'b', name: 'Gold+' }), tier({ key: 'n', id: null })]
    expect(changedTiers(draft, saved).map((t) => t.key)).toEqual(['b', 'n'])
  })

  it('turns a tier into the save input', () => {
    expect(
      tierInputOf(tier({ name: ' VIP ', customerTag: ' ', perks: [' a ', ''] })),
    ).toMatchObject({
      name: 'VIP',
      customerTag: null,
      perks: ['a'],
    })
  })

  it('converts multipliers and thresholds', () => {
    expect(multiplierText(12_500)).toBe('1.25')
    expect(parseMultiplier('1.5')).toBe(15_000)
    expect(parseMultiplier('')).toBeNull()
    expect(parseMultiplier('11')).toBeNull()
    expect(parseMultiplier('abc')).toBeNull()
    expect(thresholdFieldValue(500_000, 'spend')).toBe(5000)
    expect(thresholdFromField(5000, 'spend')).toBe(500_000)
    expect(thresholdFromField(-3, 'points')).toBe(0)
  })

  it('keeps test accounts as unique lower-case emails', () => {
    expect(cleanEmails(['A@B.in', 'a@b.in', 'nope', ' c@d.com '])).toEqual(['a@b.in', 'c@d.com'])
  })
})

describe('loyalty placements', () => {
  const widget = LOYALTY_PLACEMENTS.find((p) => p.id === 'widget')
  const block = LOYALTY_PLACEMENTS.find((p) => p.kind === 'block')

  it('says Ready or Off for embeds from the live theme, and nothing for blocks', () => {
    if (!widget || !block) throw new Error('missing placement')
    expect(placementStatus(widget, { [widget.type]: { enabled: true } })).toBe('ready')
    expect(placementStatus(widget, {})).toBe('off')
    expect(placementStatus(widget, null)).toBe('unknown')
    expect(placementStatus(block, {})).toBe('unknown')
  })

  it('opens Customize on the right panel', () => {
    expect(customizeHref('/online-store/themes/t/editor', 'embed')).toBe(
      '/online-store/themes/t/editor?panel=apps',
    )
    expect(customizeHref('/x', 'block')).toBe('/x?panel=sections')
  })
})
