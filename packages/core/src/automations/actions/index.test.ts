/** SOURCE OF TRUTH: built-in executor registration tests (actions/index.ts) — WHAT: one executor per catalogue action, tag planning and order-update template rules / WHY: a missing executor must fail here, not in a run. */
import { afterEach, describe, expect, it } from 'vitest'
import { BUILTIN_ACTION_IDS } from '../builtin-actions'
import { actionExecutor, resetActionExecutorsForTest } from '../registry'
import { builtinExecutors, missingBuiltinExecutors, registerBuiltinActions } from './index'
import { isOrderUpdateTemplate } from './order-update'
import { type BuiltinActionDeps, planTags } from './shared'

const deps = {
  registry: {},
  settingsSecret: 's',
  storefrontUrl: 'https://shop.example',
} as unknown as BuiltinActionDeps

afterEach(() => resetActionExecutorsForTest())

describe('registration', () => {
  it('has exactly one executor per built-in action', () => {
    const ids = builtinExecutors(async () => deps).map((e) => e.id)
    expect(missingBuiltinExecutors()).toEqual([])
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

describe('order update templates', () => {
  it('allows order messages only', () => {
    expect(isOrderUpdateTemplate('order_shipped')).toBe(true)
    expect(isOrderUpdateTemplate('refund_issued')).toBe(false)
    expect(isOrderUpdateTemplate('login_code')).toBe(false)
    expect(isOrderUpdateTemplate('balance_request')).toBe(false)
  })
})
