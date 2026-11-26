import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LoyaltyCartBox from '../src/components/loyalty/loyalty-cart-box'
import { forgetLoyaltyView, redeemAndApply } from '../src/components/loyalty/loyalty-client'
import {
  cartRewardRows,
  earnInfoOf,
  earnPreview,
  nextRewardOf,
  pointsWorthPaise,
  rewardProgress,
} from '../src/components/loyalty/loyalty-math'
import LoyaltyProductLine from '../src/components/loyalty/loyalty-product-line'
import {
  loyaltyStyleVars,
  resolveLoyaltyWidgetSettings,
} from '../src/components/loyalty/loyalty-settings'
import type { LoyaltyRewardView, LoyaltyView } from '../src/components/loyalty/loyalty-types'

const names = { singular: 'point', plural: 'points' }

const reward = (over: Partial<LoyaltyRewardView>): LoyaltyRewardView => ({
  id: 'r',
  type: 'amount_off',
  title: '₹50 off',
  description: null,
  pointsCost: 50,
  value: 5_000,
  minPoints: null,
  maxPoints: null,
  productId: null,
  minOrderPaise: null,
  block: null,
  ...over,
})

const view = (over: Partial<LoyaltyView> = {}): LoyaltyView => ({
  storeName: 'Waimers',
  live: true,
  signedIn: false,
  open: false,
  pointsName: names,
  pointsAsStoreCredit: true,
  pointPaise: 100,
  waysToEarn: [
    {
      id: 'w',
      type: 'order_spend',
      key: '',
      title: null,
      points: 2,
      url: null,
      streakDays: null,
      onceOnly: false,
      claimed: false,
    },
  ],
  rewards: [reward({ id: 'a' }), reward({ id: 'b', title: 'Free shipping', pointsCost: 500 })],
  tiers: [
    { id: 'gold', name: 'Gold', threshold: 100, multiplierBp: 15_000, perks: [], colors: null },
  ],
  referral: null,
  member: null,
  cart: { subtotalPaise: 249_900, productIds: ['p1'], discountCode: null },
  ...over,
})

const member = (points: number, tierId: string | null = null): LoyaltyView['member'] => ({
  points,
  expiringSoon: null,
  pendingPoints: 0,
  tier: { basis: 'points', value: 0, currentId: tierId, nextId: null, toNext: 0 },
  streakDays: 0,
  codes: [],
})

describe('product line and cart box points', () => {
  it('reads the order spend rate and the member tier multiplier off the view', () => {
    expect(earnInfoOf(view())).toEqual({ pointsPer100: 2, multiplierBp: 10_000 })
    expect(earnInfoOf(view({ member: member(0, 'gold') }))).toEqual({
      pointsPer100: 2,
      multiplierBp: 15_000,
    })
    expect(earnInfoOf(view({ waysToEarn: [] })).pointsPer100).toBe(0)
  })

  it('counts a ₹2,499 cart at 2 points per ₹100 like core (49), and 1.5x for Gold (73)', () => {
    expect(earnPreview(249_900, earnInfoOf(view()))).toBe(49)
    expect(earnPreview(249_900, earnInfoOf(view({ member: member(0, 'gold') })))).toBe(73)
  })

  it('prices points at the program point value', () => {
    expect(pointsWorthPaise(21, view())).toBe(2_100)
    expect(pointsWorthPaise(0, view())).toBe(0)
  })

  it('draws the guest line with the program and the member line with the balance', () => {
    const guest = renderToStaticMarkup(
      <LoyaltyProductLine points={21} names={names} balance={null} worthPaise={2_100} />,
    )
    expect(guest).toContain('Earn 21 points with this purchase')
    expect(guest).toContain('(worth ₹21)')
    expect(guest).toContain('Collect points with our rewards program')
    const mem = renderToStaticMarkup(
      <LoyaltyProductLine points={21} names={names} balance={1_150} worthPaise={null} />,
    )
    expect(mem).toContain('You have 1,150 points. Earn 21 points more with this order.')
  })
})

describe('reward progress and next reward', () => {
  it('fills the bar toward a reward, empty for a visitor', () => {
    expect(rewardProgress(null, 1000)).toBe(0)
    expect(rewardProgress(250, 1000)).toBe(25)
    expect(rewardProgress(5000, 1000)).toBe(100)
  })

  it('counts rewards ready now, else names the cheapest one still out of reach', () => {
    const rewards = [reward({ id: 'a', pointsCost: 50 }), reward({ id: 'b', pointsCost: 500 })]
    expect(nextRewardOf(rewards, 600)).toEqual({ kind: 'available', count: 2 })
    const next = nextRewardOf(
      rewards.map((r) => ({ ...r, block: 'points' })),
      20,
    )
    expect(next).toMatchObject({ kind: 'next', needed: 30, percent: 40 })
    expect(nextRewardOf([reward({ block: 'tier', pointsCost: 10 })], 0)).toEqual({ kind: 'none' })
  })
})

describe('cart reward rows', () => {
  it('lists the rewards that fit first, then the rest greyed with the reason', () => {
    const rows = cartRewardRows(
      [
        reward({ id: 'big', pointsCost: 900 }),
        reward({ id: 'min', minOrderPaise: 500_000 }),
        reward({ id: 'ok', pointsCost: 40 }),
        reward({ id: 'credit', type: 'store_credit' }),
        reward({ id: 'gift', type: 'free_product', productId: 'p9' }),
      ],
      { points: 100, subtotalPaise: 249_900, productIds: ['p1'] },
    )
    expect(rows.map((r) => [r.reward.id, r.ok, r.why])).toEqual([
      ['ok', true, null],
      ['min', false, 'min_order'],
      ['gift', false, 'not_in_cart'],
      ['big', false, 'points'],
    ])
  })
})

describe('cart box', () => {
  it('asks a visitor to log in and shows the points the order earns', () => {
    const html = renderToStaticMarkup(<LoyaltyCartBox view={view()} showWorth={false} />)
    expect(html).toContain('+49 points for this order')
    expect(html).toContain('Log in to redeem rewards')
    expect(html).toContain('/account/login?return_to=%2Fcart')
  })

  it('shows a member the points to redeem, collapsed, with the expand control', () => {
    const html = renderToStaticMarkup(
      <LoyaltyCartBox view={view({ signedIn: true, member: member(6_500) })} showWorth />,
    )
    expect(html).toContain('6,500 points to redeem')
    expect(html).toContain('+49 points (worth ₹49) for this order')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Redeem and apply')
  })

  it('draws nothing without a cart or for a signed-in shopper outside the program', () => {
    expect(
      renderToStaticMarkup(<LoyaltyCartBox view={view({ cart: null })} showWorth={false} />),
    ).toBe('')
    expect(
      renderToStaticMarkup(<LoyaltyCartBox view={view({ signedIn: true })} showWorth={false} />),
    ).toBe('')
  })
})

describe('redeem and apply', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    forgetLoyaltyView()
  })

  const answer = (body: unknown, ok = true) =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)

  it('claims the reward, then puts its code on the cart, and answers the code', async () => {
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        calls.push(`${url} ${init?.body ?? ''}`)
        if (url.endsWith('/redeem'))
          return answer({ id: 'x', title: 't', code: 'REWARD-1', expiresAt: null, rewardType: '' })
        return answer({ ok: true })
      }),
    )
    await expect(redeemAndApply({ id: 'r1' })).resolves.toBe('REWARD-1')
    expect(calls).toEqual([
      '/api/loyalty/redeem {"rewardId":"r1","points":null}',
      '/api/loyalty/apply {"code":"REWARD-1"}',
    ])
  })

  it('stops when the claim fails, gives no code, or the cart refuses the code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => answer({ error: 'insufficient' }, false)),
    )
    await expect(redeemAndApply({ id: 'r1' })).resolves.toBeNull()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/redeem')
          ? answer({ id: 'x', title: 't', code: null, expiresAt: null, rewardType: 'store_credit' })
          : answer({ ok: true }),
      ),
    )
    await expect(redeemAndApply({ id: 'r1' })).resolves.toBeNull()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/redeem')
          ? answer({ id: 'x', title: 't', code: 'C', expiresAt: null, rewardType: '' })
          : answer({ ok: false }),
      ),
    )
    await expect(redeemAndApply({ id: 'r1' })).resolves.toBeNull()
  })
})

describe('brand colour', () => {
  it('follows the store brand until the merchant picks a header colour', () => {
    expect(resolveLoyaltyWidgetSettings({}, '#6C3BAA').headerColor).toBe('#6C3BAA')
    // The stock colour every embed saved before 26 Nov counts as not picked.
    expect(resolveLoyaltyWidgetSettings({ headerColor: '#1f2937' }, '#6C3BAA').headerColor).toBe(
      '#6C3BAA',
    )
    expect(resolveLoyaltyWidgetSettings({ headerColor: '#112233' }, '#6C3BAA').headerColor).toBe(
      '#112233',
    )
    expect(resolveLoyaltyWidgetSettings({}, null).headerColor).toBe('#3c56e9')
    expect(resolveLoyaltyWidgetSettings({}, 'red;}').headerColor).toBe('#3c56e9')
  })

  it('keeps product line and cart box on unless switched off, value off unless on', () => {
    expect(resolveLoyaltyWidgetSettings({})).toMatchObject({
      productLine: true,
      cartBox: true,
      pointsValue: false,
    })
    expect(
      resolveLoyaltyWidgetSettings({ productLine: false, cartBox: false, pointsValue: true }),
    ).toMatchObject({ productLine: false, cartBox: false, pointsValue: true })
  })

  it('paints icons in the brand colour and buttons near-black', () => {
    const vars = loyaltyStyleVars(resolveLoyaltyWidgetSettings({}, '#6C3BAA'))
    expect(vars['--kl-accent']).toBe('#6C3BAA')
    expect(vars['--kl-button']).toBe('#222222')
  })
})
