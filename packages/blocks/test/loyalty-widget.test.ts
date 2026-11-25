import { describe, expect, it } from 'vitest'
import {
  rewardGlyph,
  wayGlyph,
  wayPoints,
  wayTitle,
} from '../src/components/loyalty/loyalty-format'
import {
  earnPreview,
  priceFromText,
  referralParam,
  rewardsForCart,
  tierPercent,
} from '../src/components/loyalty/loyalty-math'
import {
  LOYALTY_WIDGET_DEFAULTS,
  loyaltyStyleVars,
  programTitle,
  resolveLoyaltyWidgetSettings,
} from '../src/components/loyalty/loyalty-settings'
import { shareNetworksOf, shareUrl } from '../src/components/loyalty/loyalty-share'
import type { LoyaltyRewardView } from '../src/components/loyalty/loyalty-types'

const reward = (over: Partial<LoyaltyRewardView>): LoyaltyRewardView => ({
  id: 'r',
  type: 'amount_off',
  title: '₹100 off',
  description: null,
  pointsCost: 100,
  value: 10_000,
  minPoints: null,
  maxPoints: null,
  productId: null,
  minOrderPaise: null,
  block: null,
  ...over,
})

describe('earn preview', () => {
  it('counts floor(price × rate / ₹100) like core', () => {
    expect(earnPreview(129_900, { pointsPer100: 1, multiplierBp: 10_000 })).toBe(12)
    expect(earnPreview(9_999, { pointsPer100: 1, multiplierBp: 10_000 })).toBe(0)
    expect(earnPreview(100_000, { pointsPer100: 5, multiplierBp: 10_000 })).toBe(50)
  })

  it('applies the tier multiplier after flooring the base', () => {
    // base 12, × 1.25 = 15
    expect(earnPreview(129_900, { pointsPer100: 1, multiplierBp: 12_500 })).toBe(15)
    // base 3, × 1.5 = 4.5 → 4
    expect(earnPreview(30_000, { pointsPer100: 1, multiplierBp: 15_000 })).toBe(4)
  })

  it('earns nothing with the rule off, a bad price, or a zero multiplier treated as 1x', () => {
    expect(earnPreview(100_000, { pointsPer100: 0, multiplierBp: 10_000 })).toBe(0)
    expect(earnPreview(Number.NaN, { pointsPer100: 1, multiplierBp: 10_000 })).toBe(0)
    expect(earnPreview(-500, { pointsPer100: 1, multiplierBp: 10_000 })).toBe(0)
    expect(earnPreview(100_000, { pointsPer100: 1, multiplierBp: 0 })).toBe(10)
  })
})

describe('rewards that fit the cart', () => {
  const cart = { points: 300, subtotalPaise: 50_000, productIds: ['p1'] }

  it('keeps rewards the shopper can take with enough points, cheapest first', () => {
    const fit = rewardsForCart(
      [
        reward({ id: 'b', pointsCost: 250 }),
        reward({ id: 'a', pointsCost: 100 }),
        reward({ id: 'c', pointsCost: 400 }),
      ],
      cart,
    )
    expect(fit.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('leaves out blocked rewards, store credit and unmet minimum orders', () => {
    const fit = rewardsForCart(
      [
        reward({ id: 'blocked', block: 'tier' }),
        reward({ id: 'credit', type: 'store_credit' }),
        reward({ id: 'min', minOrderPaise: 100_000 }),
        reward({ id: 'ok', minOrderPaise: 50_000 }),
      ],
      cart,
    )
    expect(fit.map((r) => r.id)).toEqual(['ok'])
  })

  it('wants a free product in the cart and an amount off no larger than the cart', () => {
    const fit = rewardsForCart(
      [
        reward({ id: 'free-in', type: 'free_product', productId: 'p1' }),
        reward({ id: 'free-out', type: 'free_product', productId: 'p2' }),
        reward({ id: 'too-big', value: 60_000 }),
        reward({ id: 'pct', type: 'percent_off', value: 1000 }),
      ],
      cart,
    )
    expect(fit.map((r) => r.id).sort()).toEqual(['free-in', 'pct'])
  })

  it('prices a custom amount reward at its minimum step', () => {
    const custom = reward({ id: 'c', type: 'custom_amount_off', pointsCost: 50, minPoints: 400 })
    expect(rewardsForCart([custom], cart)).toEqual([])
    expect(rewardsForCart([custom], { ...cart, points: 400 })).toHaveLength(1)
  })
})

describe('tier progress and theme prices', () => {
  it('is a 0..100 share of the next threshold, 100 on the top tier', () => {
    expect(tierPercent(250, 1000)).toBe(25)
    expect(tierPercent(2000, 1000)).toBe(100)
    expect(tierPercent(10, null)).toBe(100)
  })

  it('reads the last amount from a theme price text', () => {
    expect(priceFromText('Rs. 1,299.00')).toBe(129_900)
    expect(priceFromText('Regular price ₹2,499 Sale price ₹1,999')).toBe(199_900)
    expect(priceFromText('From ₹999')).toBe(99_900)
    expect(priceFromText('Sold out')).toBeNull()
    expect(priceFromText(null)).toBeNull()
  })
})

describe('referral landing', () => {
  it('takes a member code from ?ref=, upper-cased', () => {
    expect(referralParam('?ref=abcd2345')).toBe('ABCD2345')
    expect(referralParam('?utm_source=x&ref=ABCD2345')).toBe('ABCD2345')
  })

  it('ignores a missing or odd code', () => {
    expect(referralParam('')).toBeNull()
    expect(referralParam('?ref=ab')).toBeNull()
    expect(referralParam('?ref=<script>')).toBeNull()
    expect(referralParam('?ref=affiliate-name')).toBeNull()
  })
})

describe('share links', () => {
  const input = {
    url: 'https://shop.in/?ref=ABCD2345',
    text: 'Here is 10% off:',
    subject: 'A gift',
  }

  it('builds each network’s share URL with the link encoded', () => {
    const enc = encodeURIComponent(input.url)
    expect(shareUrl('whatsapp', input)).toBe(
      `https://wa.me/?text=${encodeURIComponent(`${input.text} ${input.url}`)}`,
    )
    expect(shareUrl('facebook', input)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${enc}`)
    expect(shareUrl('x', input)).toContain(`&url=${enc}`)
    expect(shareUrl('telegram', input)).toContain(`url=${enc}`)
    expect(shareUrl('messenger', input)).toBe(`fb-messenger://share/?link=${enc}`)
    expect(shareUrl('threads', input)).toContain('threads.net/intent/post?text=')
    expect(shareUrl('email', input)).toMatch(/^mailto:\?subject=A%20gift&body=/)
  })

  it('draws the program’s chosen channels in a fixed order, the default four when unset', () => {
    expect(shareNetworksOf(undefined)).toEqual(['whatsapp', 'email', 'x', 'facebook'])
    expect(shareNetworksOf(['telegram', 'whatsapp', 'myspace'])).toEqual(['whatsapp', 'telegram'])
    expect(shareNetworksOf([])).toEqual([])
    expect(shareNetworksOf(['threads', 'messenger', 'x'])).toEqual(['x', 'messenger', 'threads'])
  })
})

describe('embed settings', () => {
  it('starts from the defaults', () => {
    const s = resolveLoyaltyWidgetSettings(LOYALTY_WIDGET_DEFAULTS)
    expect(s).toMatchObject({
      layout: 'popup',
      position: 'right',
      headerGradient: null,
      launcherIcon: 'gift',
      cardPoints: false,
      priceSelector: '',
    })
  })

  it('falls back on anything unknown and keeps colours to hex', () => {
    const s = resolveLoyaltyWidgetSettings({
      layout: 'sidebar',
      position: 'left',
      headerColor: 'red; background: url(x)',
      headerGradient: '#ABCDEF',
      headerText: '#fff',
      launcherIcon: 'rocket',
      priceSelector: '.price</style>',
    })
    expect(s.layout).toBe('sidebar')
    expect(s.position).toBe('left')
    expect(s.headerColor).toBe(LOYALTY_WIDGET_DEFAULTS.headerColor)
    expect(s.headerGradient).toBe('#ABCDEF')
    expect(s.headerText).toBe('#fff')
    expect(s.launcherIcon).toBe('gift')
    expect(s.priceSelector).toBe('')
  })

  it('draws a gradient header only with a second colour', () => {
    const flat = loyaltyStyleVars(resolveLoyaltyWidgetSettings({ headerColor: '#111111' }))
    expect(flat['--kl-head']).toBe('#111111')
    const grad = loyaltyStyleVars(
      resolveLoyaltyWidgetSettings({ headerColor: '#111111', headerGradient: '#222222' }),
    )
    expect(grad['--kl-head']).toBe('linear-gradient(135deg, #111111, #222222)')
  })

  it('names the program after the store unless the merchant named it', () => {
    expect(programTitle({ title: '' }, 'Waimers')).toBe('Waimers Rewards')
    expect(programTitle({ title: 'Club W' }, 'Waimers')).toBe('Club W')
  })
})

describe('panel list rows', () => {
  const names = { singular: 'point', plural: 'points' }
  it('words earn rows like Essential Loyalty: titles and a plus on the points', () => {
    expect(wayTitle({ title: null, type: 'birthday', key: '', streakDays: null })).toBe(
      'Celebrate a birthday',
    )
    expect(wayPoints({ type: 'signup', points: 600 }, names)).toBe('+600 points')
    expect(wayPoints({ type: 'order_spend', points: 8 }, names)).toBe(
      '+8 points for every ₹100 spent',
    )
  })

  it('gives each rule and reward an icon, with a fallback for new types', () => {
    expect(wayGlyph('newsletter')).toBe('mail')
    expect(wayGlyph('something_new')).toBe('star')
    expect(rewardGlyph('free_shipping')).toBe('truck')
    expect(rewardGlyph('percent_off')).toBe('tag')
  })
})
