import type { Permission } from '@commerce/core/permissions'
import { describe, expect, it } from 'vitest'
import { levelOf, type RoleAccess, setLevel, toggleResource } from './role-access'

const p = (s: string) => s as Permission
const sorted = (a: RoleAccess) => ({ granted: [...a.granted].sort(), asks: [...a.asks].sort() })
const empty: RoleAccess = { granted: [], asks: [] }

describe('role editor Off / Allowed / Ask first', () => {
  it('Ask first is a grant that asks; it turns the resource Read on', () => {
    const next = setLevel(empty, p('orders.refund'), 'ask', true)
    expect(sorted(next)).toEqual({
      granted: ['orders.read', 'orders.refund'],
      asks: ['orders.refund'],
    })
    expect(levelOf(next, p('orders.refund'), true)).toBe('ask')
    expect(levelOf(next, p('orders.read'), true)).toBe('allowed')
    expect(levelOf(next, p('orders.cancel'), true)).toBe('off')
  })

  it('Allowed drops the tick; Off drops both', () => {
    const asking = setLevel(empty, p('orders.refund'), 'ask', true)
    expect(sorted(setLevel(asking, p('orders.refund'), 'allowed', true))).toEqual({
      granted: ['orders.read', 'orders.refund'],
      asks: [],
    })
    expect(sorted(setLevel(asking, p('orders.refund'), 'off', true))).toEqual({
      granted: ['orders.read'],
      asks: [],
    })
  })

  it('turning Read off turns the resource off, ticks included', () => {
    const asking = setLevel(empty, p('orders.refund'), 'ask', true)
    expect(sorted(setLevel(asking, p('orders.read'), 'off', true))).toEqual(empty)
  })

  it('leaves the ticks alone for anyone but the owner', () => {
    const role: RoleAccess = { granted: [], asks: [p('orders.refund')] }
    const next = setLevel(role, p('orders.refund'), 'allowed', false)
    // The server keeps the tick, so the row shows what will really happen: it asks.
    expect(next.asks).toEqual(['orders.refund'])
    expect(levelOf(next, p('orders.refund'), true)).toBe('ask')
    expect(setLevel(next, p('orders.refund'), 'off', false).asks).toEqual(['orders.refund'])
  })

  it('Select all grants the resource and keeps its ticks; Clear removes both', () => {
    const asking = setLevel(empty, p('orders.refund'), 'ask', true)
    const all = toggleResource(asking, 'orders', true)
    expect(all.granted).toEqual(expect.arrayContaining(['orders.read', 'orders.cancel']))
    expect(all.asks).toEqual(['orders.refund'])
    expect(sorted(toggleResource(all, 'orders', true))).toEqual(empty)
  })

  it('shows no Ask first on the owner role', () => {
    const role: RoleAccess = { granted: [p('orders.refund')], asks: [p('orders.refund')] }
    expect(levelOf(role, p('orders.refund'), false)).toBe('allowed')
  })
})
