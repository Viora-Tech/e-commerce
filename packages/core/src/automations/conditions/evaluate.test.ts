import { describe, expect, it } from 'vitest'
import type { Rule, RuleGroup } from '../definition'
import { evaluateRulesAt, readPath } from './evaluate'
import { evaluateRules } from './index'

const NOW = new Date('2026-10-23T12:00:00Z')
const all = (...rules: (Rule | RuleGroup)[]): RuleGroup => ({ join: 'and', rules })
const any = (...rules: (Rule | RuleGroup)[]): RuleGroup => ({ join: 'or', rules })
const check = (rule: Rule, data: Record<string, unknown>) =>
  evaluateRulesAt(all(rule), data, { now: NOW }).pass

const order = {
  order: {
    number: '1042',
    total: 245_000,
    is_cod: true,
    financial_status: 'pending',
    tags: ['VIP', 'Gift'],
    shipping_city: 'Pune',
    shipping_pincode: '',
    created_at: '2026-10-20T08:00:00.000Z',
    line_items: [
      { sku: 'TEE-1', quantity: 1, price: 49_900, product_tags: ['summer'] },
      { sku: 'MUG-2', quantity: 3, price: 29_900, product_tags: ['kitchen', 'gift'] },
    ],
    customer: { order_count: 3, email_consent: false, tags: [] },
  },
  store: { timezone: 'Asia/Kolkata' },
}

describe('number and money', () => {
  it.each([
    ['eq', 245_000, true],
    ['eq', 245_001, false],
    ['neq', 1, true],
    ['gt', 200_000, true],
    ['gt', 245_000, false],
    ['gte', 245_000, true],
    ['lt', 300_000, true],
    ['lte', 245_000, true],
    ['lte', 244_999, false],
  ] as const)('order.total %s %d → %s', (op, value, pass) => {
    expect(check({ field: 'order.total', op, value }, order)).toBe(pass)
  })

  it('compares numbers typed as text and fails on a missing value (except not equal)', () => {
    expect(check({ field: 'order.customer.order_count', op: 'gte', value: '3' }, order)).toBe(true)
    expect(check({ field: 'order.subtotal', op: 'gt', value: 0 }, order)).toBe(false)
    expect(check({ field: 'order.subtotal', op: 'neq', value: 0 }, order)).toBe(true)
  })
})

describe('text', () => {
  it.each([
    ['eq', 'pune', true],
    ['eq', ' PUNE ', true],
    ['neq', 'Mumbai', true],
    ['contains', 'un', true],
    ['contains', '', false],
    ['not_contains', 'mum', true],
    ['starts_with', 'pu', true],
    ['starts_with', 'ne', false],
    ['is_empty', undefined, false],
    ['is_not_empty', undefined, true],
  ] as const)('order.shipping_city %s %s → %s', (op, value, pass) => {
    expect(check({ field: 'order.shipping_city', op, value }, order)).toBe(pass)
  })

  it('treats a blank value as empty', () => {
    expect(check({ field: 'order.shipping_pincode', op: 'is_empty' }, order)).toBe(true)
  })
})

describe('tags', () => {
  it('includes any of the tags by default, every one with all, none with none', () => {
    const f = 'order.tags'
    expect(check({ field: f, op: 'includes', value: 'vip' }, order)).toBe(true)
    expect(check({ field: f, op: 'includes', value: ['x', 'gift'] }, order)).toBe(true)
    expect(
      check({ field: f, op: 'includes', value: ['x', 'gift'], quantifier: 'all' }, order),
    ).toBe(false)
    expect(
      check({ field: f, op: 'includes', value: ['vip', 'gift'], quantifier: 'all' }, order),
    ).toBe(true)
    expect(check({ field: f, op: 'includes', value: ['x'], quantifier: 'none' }, order)).toBe(true)
    expect(check({ field: f, op: 'not_includes', value: 'VIP' }, order)).toBe(false)
    expect(check({ field: f, op: 'not_includes', value: ['x', 'y'] }, order)).toBe(true)
    expect(check({ field: f, op: 'includes', value: [] }, order)).toBe(false)
  })

  it('is_empty / is_not_empty', () => {
    expect(check({ field: 'order.customer.tags', op: 'is_empty' }, order)).toBe(true)
    expect(check({ field: 'order.tags', op: 'is_not_empty' }, order)).toBe(true)
  })
})

describe('boolean', () => {
  it('is_true / is_false, a missing value counting as false', () => {
    expect(check({ field: 'order.is_cod', op: 'is_true' }, order)).toBe(true)
    expect(check({ field: 'order.is_cod', op: 'is_false' }, order)).toBe(false)
    expect(check({ field: 'order.customer.email_consent', op: 'is_false' }, order)).toBe(true)
    expect(check({ field: 'order.customer.whatsapp_consent', op: 'is_false' }, order)).toBe(true)
  })
})

describe('date', () => {
  it('within the last N days counts back from now', () => {
    expect(check({ field: 'order.created_at', op: 'within_last_days', value: 4 }, order)).toBe(true)
    expect(check({ field: 'order.created_at', op: 'within_last_days', value: 3 }, order)).toBe(
      false,
    )
  })

  it('reads calendar dates as midnight in the store zone', () => {
    // 2026-10-20T08:00Z is 13:30 on the 20th in India.
    const at = (v: string, op: 'before' | 'after') =>
      check({ field: 'order.created_at', op, value: v }, order)
    expect(at('2026-10-21', 'before')).toBe(true)
    expect(at('2026-10-20', 'before')).toBe(false)
    expect(at('2026-10-19', 'after')).toBe(true)
    expect(at('2026-10-20', 'after')).toBe(false)
    // 2026-10-20T19:00Z is already the 21st in India (00:30), but still the 20th in UTC.
    const late = { order: { created_at: '2026-10-20T19:00:00.000Z' }, store: order.store }
    expect(check({ field: 'order.created_at', op: 'after', value: '2026-10-20' }, late)).toBe(true)
    const utc = { order: { created_at: '2026-10-20T19:00:00.000Z' }, store: { timezone: 'UTC' } }
    expect(check({ field: 'order.created_at', op: 'after', value: '2026-10-20' }, utc)).toBe(false)
  })

  it('takes full timestamps as they are and fails on missing or bad dates', () => {
    expect(
      check({ field: 'order.created_at', op: 'after', value: '2026-10-20T07:59:00Z' }, order),
    ).toBe(true)
    expect(check({ field: 'order.created_at', op: 'before', value: 'soon' }, order)).toBe(false)
    expect(check({ field: 'customer.created_at', op: 'before', value: '2030-01-01' }, order)).toBe(
      false,
    )
  })
})

describe('enum', () => {
  it('is_one_of, eq, neq', () => {
    const f = 'order.financial_status'
    expect(check({ field: f, op: 'is_one_of', value: ['pending', 'paid'] }, order)).toBe(true)
    expect(check({ field: f, op: 'is_one_of', value: ['paid'] }, order)).toBe(false)
    expect(check({ field: f, op: 'eq', value: 'pending' }, order)).toBe(true)
    expect(check({ field: f, op: 'neq', value: 'pending' }, order)).toBe(false)
  })

  it('refuses an operator the field type does not allow', () => {
    expect(check({ field: 'order.financial_status', op: 'contains', value: 'pen' }, order)).toBe(
      false,
    )
  })
})

describe('line items: any / all / none', () => {
  const q = (quantifier: 'any' | 'all' | 'none', op: Rule['op'], value: unknown) =>
    check({ field: 'order.line_items.quantity', op, value, quantifier }, order)

  it('any line by default', () => {
    expect(check({ field: 'order.line_items.sku', op: 'eq', value: 'mug-2' }, order)).toBe(true)
    expect(q('any', 'gt', 2)).toBe(true)
  })

  it('all lines, and all over no lines does not hold', () => {
    expect(q('all', 'gte', 1)).toBe(true)
    expect(q('all', 'gt', 1)).toBe(false)
    const empty = { order: { line_items: [] } }
    expect(
      check({ field: 'order.line_items.quantity', op: 'gt', value: 0, quantifier: 'all' }, empty),
    ).toBe(false)
    expect(
      check({ field: 'order.line_items.quantity', op: 'gt', value: 0, quantifier: 'none' }, empty),
    ).toBe(true)
  })

  it('none of the lines', () => {
    expect(q('none', 'gt', 5)).toBe(true)
    expect(q('none', 'gt', 2)).toBe(false)
  })

  it('money per line in paise and tags per line', () => {
    expect(check({ field: 'order.line_items.price', op: 'lt', value: 30_000 }, order)).toBe(true)
    const tags = (quantifier: 'any' | 'all' | 'none', value: string) =>
      check({ field: 'order.line_items.product_tags', op: 'includes', value, quantifier }, order)
    expect(tags('any', 'Gift')).toBe(true)
    expect(tags('all', 'gift')).toBe(false)
    expect(tags('none', 'toys')).toBe(true)
  })
})

describe('groups', () => {
  const big = { field: 'order.total', op: 'gt', value: 200_000 } as const
  const prepaid = { field: 'order.is_cod', op: 'is_false' } as const
  const pune = { field: 'order.shipping_city', op: 'eq', value: 'Pune' } as const

  it('AND needs every rule, OR any, and nested groups combine', () => {
    expect(evaluateRulesAt(all(big, prepaid), order, { now: NOW }).pass).toBe(false)
    expect(evaluateRulesAt(any(big, prepaid), order, { now: NOW }).pass).toBe(true)
    expect(evaluateRulesAt(all(pune, any(prepaid, big)), order, { now: NOW }).pass).toBe(true)
    expect(evaluateRulesAt(any(prepaid, all(big, prepaid)), order, { now: NOW }).pass).toBe(false)
  })

  it('traces every rule with what it read, for the run log', () => {
    const r = evaluateRulesAt(any(big, prepaid), order, { now: NOW })
    expect(r.trace).toEqual([
      { field: 'order.total', op: 'gt', expected: 200_000, actual: 245_000, pass: true },
      { field: 'order.is_cod', op: 'is_false', expected: undefined, actual: true, pass: false },
    ])
  })

  it('an empty group holds', () => {
    expect(evaluateRules(all(), {}).pass).toBe(true)
  })
})

describe('fields outside the catalogue (plugin trigger data)', () => {
  const data = { trigger: { score: 7, label: 'Hot lead', labels: ['a'], ok: true } }
  it('infers the type from the operator and value', () => {
    expect(check({ field: 'trigger.score', op: 'gt', value: 5 }, data)).toBe(true)
    expect(check({ field: 'trigger.label', op: 'contains', value: 'hot' }, data)).toBe(true)
    expect(check({ field: 'trigger.labels', op: 'includes', value: 'A' }, data)).toBe(true)
    expect(check({ field: 'trigger.ok', op: 'is_true' }, data)).toBe(true)
    expect(check({ field: 'trigger.label', op: 'is_one_of', value: ['Hot lead'] }, data)).toBe(true)
  })
})

describe('readPath', () => {
  it('walks objects and collects through lists', () => {
    expect(readPath(order, 'order.line_items.sku')).toEqual({
      value: ['TEE-1', 'MUG-2'],
      list: true,
    })
    expect(readPath(order, 'order.missing.deep')).toEqual({ value: undefined, list: false })
  })
})
