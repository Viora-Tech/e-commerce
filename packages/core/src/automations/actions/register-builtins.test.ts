import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_ACTION_IDS } from '../builtin-actions'
import { actionExecutor, resetActionExecutorsForTest } from '../registry'
import { isOrderUpdateTemplate } from './messages'
import { metafieldInput } from './records'
import {
  builtinExecutors,
  missingBuiltinExecutors,
  registerBuiltinActions,
} from './register-builtins'
import { type BuiltinActionDeps, planTags } from './shared'

const deps = {
  registry: {},
  settingsSecret: 's',
  storefrontUrl: 'https://shop.example',
} as unknown as BuiltinActionDeps

afterEach(() => resetActionExecutorsForTest())

describe('registration', () => {
  it('has exactly one executor per built-in action', () => {
    const ids = builtinExecutors(deps).map((e) => e.id)
    expect(missingBuiltinExecutors(deps)).toEqual([])
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual([...BUILTIN_ACTION_IDS].sort())
  })

  it('registers them all once, however often it is called', () => {
    registerBuiltinActions(deps)
    registerBuiltinActions(deps)
    for (const id of BUILTIN_ACTION_IDS) expect(actionExecutor(id)?.id).toBe(id)
  })
})

describe('planTags', () => {
  it('adds only missing tags, ignoring case, within the cap', () => {
    expect(planTags(['VIP'], ['vip', 'Gift'], 'add')).toEqual({
      next: ['VIP', 'Gift'],
      changed: ['Gift'],
      unchanged: ['vip'],
    })
    expect(planTags(['a', 'b'], ['c', 'd'], 'add', 3).changed).toEqual(['c'])
  })

  it('removes present tags ignoring case', () => {
    expect(planTags(['VIP', 'Gift'], ['vip', 'x'], 'remove')).toEqual({
      next: ['Gift'],
      changed: ['VIP'],
      unchanged: ['x'],
    })
  })
})

describe('metafieldInput', () => {
  it('passes scalars as text, parses JSON types and splits lists', () => {
    expect(metafieldInput(' 42 ', 'number_integer', false)).toBe('42')
    expect(metafieldInput('{"amount":10,"currency":"INR"}', 'money', false)).toEqual({
      amount: 10,
      currency: 'INR',
    })
    expect(metafieldInput('{broken', 'money', false)).toBe('{broken')
    expect(metafieldInput('a, b\nc', 'single_line_text', true)).toEqual(['a', 'b', 'c'])
    expect(metafieldInput('[1,2]', 'number_integer', true)).toEqual([1, 2])
  })
})

describe('order update templates', () => {
  it('allows order messages only', () => {
    expect(isOrderUpdateTemplate('order_shipped')).toBe(true)
    expect(isOrderUpdateTemplate('refund_issued')).toBe(false)
    expect(isOrderUpdateTemplate('login_code')).toBe(false)
    expect(isOrderUpdateTemplate('balance_request')).toBe(false)
  })
})
