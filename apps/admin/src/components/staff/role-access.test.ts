import type { Permission } from '@commerce/core/permissions'
import { describe, expect, it } from 'vitest'
import {
  areaActionChanges,
  askable,
  canPick,
  countLevels,
  type EditRules,
  levelOf,
  pickAreaLevel,
  pickLevel,
  type RoleAccess,
  resourcePermissions,
  roleEditorKey,
  setLevel,
} from './role-access'

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

  it('shows no Ask first on the owner role', () => {
    const role: RoleAccess = { granted: [p('orders.refund')], asks: [p('orders.refund')] }
    expect(levelOf(role, p('orders.refund'), false)).toBe('allowed')
  })
})

const owner: EditRules = { grantsLocked: false, askEditable: true, showAsk: true }
const manager: EditRules = { grantsLocked: false, askEditable: false, showAsk: true }
const ownerOnBuiltIn: EditRules = { grantsLocked: true, askEditable: true, showAsk: true }
const orders = resourcePermissions('orders')
const ordersAskable = orders.filter((x) => askable(x, true))

describe('area quick actions and row rules', () => {
  it('Allow all turns every row of the area to Allowed and drops its ticks', () => {
    const asking = setLevel(empty, p('orders.refund'), 'ask', true)
    const all = pickAreaLevel(asking, 'orders', 'allowed', owner)
    for (const x of orders) expect(levelOf(all, x, true)).toBe('allowed')
    expect(all.asks).toEqual([])
  })

  it('Ask first for all asks on every row that can ask; reads stay Allowed', () => {
    const all = pickAreaLevel(empty, 'orders', 'ask', owner)
    for (const x of ordersAskable) expect(levelOf(all, x, true)).toBe('ask')
    expect(levelOf(all, p('orders.read'), true)).toBe('allowed')
  })

  it('Turn all off clears the area', () => {
    const all = pickAreaLevel(empty, 'orders', 'allowed', owner)
    expect(sorted(pickAreaLevel(all, 'orders', 'off', owner))).toEqual(empty)
  })

  it('a member who is not the owner cannot move rows into or out of Ask first', () => {
    const asking = setLevel(empty, p('orders.refund'), 'ask', true)
    expect(canPick(asking, p('orders.refund'), 'allowed', manager)).toBe(false)
    expect(canPick(asking, p('orders.cancel'), 'ask', manager)).toBe(false)
    expect(areaActionChanges(empty, 'orders', 'ask', manager)).toBe(false)
    const all = pickAreaLevel(asking, 'orders', 'allowed', manager)
    expect(levelOf(all, p('orders.refund'), true)).toBe('ask')
  })

  it('a built-in role keeps its grants: only Ask first moves, off rows stay off', () => {
    const builtIn = pickAreaLevel(
      { granted: [p('orders.read'), p('orders.refund')], asks: [p('orders.refund')] },
      'orders',
      'allowed',
      ownerOnBuiltIn,
    )
    expect(sorted(builtIn)).toEqual({ granted: ['orders.read', 'orders.refund'], asks: [] })
    expect(canPick(builtIn, p('orders.refund'), 'off', ownerOnBuiltIn)).toBe(false)
    expect(canPick(builtIn, p('orders.cancel'), 'allowed', ownerOnBuiltIn)).toBe(false)
    expect(pickLevel(builtIn, p('orders.cancel'), 'ask', ownerOnBuiltIn)).toBe(builtIn)
    const asked = pickAreaLevel(builtIn, 'orders', 'ask', ownerOnBuiltIn)
    expect(sorted(asked)).toEqual({
      granted: ['orders.read', 'orders.refund'],
      asks: ['orders.refund'],
    })
  })

  it('counts allowed, ask first and off for the summary bar', () => {
    const role = pickAreaLevel(empty, 'orders', 'ask', owner)
    const counts = countLevels(role, true, orders)
    expect(counts).toEqual({ allowed: 1, ask: ordersAskable.length, off: 0 })
    expect(countLevels(role, false, orders)).toEqual({ allowed: orders.length, ask: 0, off: 0 })
    const total = countLevels(empty, true)
    expect(total.off).toBeGreaterThan(orders.length)
    expect(total.allowed + total.ask).toBe(0)
  })
})

describe('role editor key (#1623)', () => {
  const role = {
    id: 'r1',
    name: 'Administrator',
    description: null,
    permissions: [p('orders.read'), p('orders.refund')],
    needsApproval: [p('orders.refund')],
  }

  it('changes when what is saved changes, so a fresh read mounts a fresh form', () => {
    expect(roleEditorKey({ ...role, needsApproval: [] })).not.toBe(roleEditorKey(role))
    expect(roleEditorKey({ ...role, permissions: [p('orders.read')] })).not.toBe(
      roleEditorKey(role),
    )
  })

  it('ignores the order the server lists permissions in', () => {
    expect(roleEditorKey({ ...role, permissions: [...role.permissions].reverse() })).toBe(
      roleEditorKey(role),
    )
  })
})
