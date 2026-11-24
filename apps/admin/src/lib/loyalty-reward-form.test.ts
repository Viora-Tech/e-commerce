import { EarnRuleInputSchema, RewardInputSchema } from '@commerce/core/loyalty'
import { describe, expect, it } from 'vitest'
import {
  amountText,
  fillTitle,
  newRewardForm,
  type RewardTitles,
  rewardFormOf,
  rewardInputOf,
  rewardProblem,
  switchType,
  titleTemplate,
} from './loyalty-reward-form'
import { newRuleForm, RULE_CATALOG, ruleFormOf, ruleInputOf, validUrl } from './loyalty-rules'

const money = (paise: number) => `₹${paise / 100}`

const TITLES: RewardTitles = {
  amount_off: '{amount} off',
  custom_amount_off: '{amount} off per step',
  percent_off: '{amount} off',
  free_product: 'Free {amount}',
  free_shipping: 'Free shipping',
  store_credit: '{amount} store credit',
}

describe('reward form', () => {
  it('fills and recovers the {amount} placeholder', () => {
    expect(fillTitle('{amount} off', '₹50')).toBe('₹50 off')
    expect(titleTemplate('₹50 off your order', '₹50')).toBe('{amount} off your order')
    expect(titleTemplate('A treat', '₹50')).toBe('A treat')
  })

  it('writes the amount per type', () => {
    expect(amountText({ type: 'amount_off', value: '50', productTitle: '' }, money)).toBe('₹50')
    expect(amountText({ type: 'percent_off', value: '12.5', productTitle: '' }, money)).toBe(
      '12.5%',
    )
    expect(amountText({ type: 'free_product', value: '', productTitle: 'Mug' }, money)).toBe('Mug')
    expect(amountText({ type: 'free_shipping', value: '', productTitle: '' }, money)).toBe('')
  })

  it('makes a save input the server accepts', () => {
    const f = { ...newRewardForm('amount_off', TITLES, 0), value: '50', minOrder: '499' }
    const input = rewardInputOf(f, money)
    expect(input).toMatchObject({
      title: '₹50 off',
      value: 5000,
      minOrderPaise: 49_900,
      codeDays: 90,
    })
    expect(RewardInputSchema.safeParse(input).success).toBe(true)

    const pct = rewardInputOf({ ...newRewardForm('percent_off', TITLES, 0), value: '10' }, money)
    expect(pct).toMatchObject({ value: 1000, title: '10% off' })

    const credit = rewardInputOf(
      { ...newRewardForm('store_credit', TITLES, 0), codeDays: '30' },
      money,
    )
    expect(credit.codeDays).toBeNull()
  })

  it('round-trips a saved reward back into the form', () => {
    const f = { ...newRewardForm('amount_off', TITLES, 2), value: '75' }
    const input = RewardInputSchema.parse(rewardInputOf(f, money))
    const row = { ...input, id: 'x', usedCount: 0 } as never
    expect(rewardFormOf(row, '', money)).toMatchObject({ title: '{amount} off', value: '75' })
  })

  it('keeps a written title when the type changes, resets a standard one', () => {
    const start = newRewardForm('amount_off', TITLES, 0)
    expect(switchType(start, 'free_shipping', TITLES).title).toBe('Free shipping')
    const own = { ...start, title: 'Big {amount} treat' }
    expect(switchType(own, 'percent_off', TITLES).title).toBe('Big {amount} treat')
  })

  it('names the first problem', () => {
    const f = newRewardForm('free_product', TITLES, 0)
    expect(rewardProblem(f)).toBe('product')
    expect(rewardProblem({ ...f, productId: 'p' })).toBeNull()
    expect(rewardProblem({ ...newRewardForm('percent_off', TITLES, 0), value: '120' })).toBe(
      'percent',
    )
    expect(rewardProblem({ ...newRewardForm('amount_off', TITLES, 0), title: ' ' })).toBe('title')
    const custom = {
      ...newRewardForm('custom_amount_off', TITLES, 0),
      minPoints: '50',
      maxPoints: '10',
    }
    expect(rewardProblem(custom)).toBe('range')
  })
})

describe('earning rule catalog', () => {
  it('lists every type but the base rate, and each social platform', () => {
    expect(RULE_CATALOG.some((c) => c.type === 'order_spend')).toBe(false)
    expect(RULE_CATALOG.filter((c) => c.type === 'social').length).toBe(11)
  })

  it('makes inputs the server accepts for each catalog entry', () => {
    for (const c of RULE_CATALOG) {
      const f = { ...newRuleForm(c, 1), url: 'https://example.com/page' }
      const r = EarnRuleInputSchema.safeParse(ruleInputOf(f))
      expect(r.success, `${c.type}:${c.key}`).toBe(true)
    }
  })

  it('reads a saved rule back', () => {
    const row = {
      id: 'r',
      type: 'social',
      key: 'instagram',
      title: null,
      points: 30,
      settings: { url: 'https://instagram.com/x', action: 'join' },
      enabled: true,
      position: 3,
    } as never
    expect(ruleFormOf(row)).toMatchObject({
      url: 'https://instagram.com/x',
      action: 'join',
      title: '',
    })
  })

  it('takes only http links', () => {
    expect(validUrl('https://a.in')).toBe(true)
    expect(validUrl('javascript:alert(1)')).toBe(false)
    expect(validUrl('nope')).toBe(false)
  })
})
