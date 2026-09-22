import { describe, expect, it } from 'vitest'
import { isSystemRoleSlug, roleSlug, SYSTEM_ROLES } from './roles'
import {
  ALL_PERMISSIONS,
  isPermission,
  permission,
  permissions,
  RESOURCE_METADATA,
  sanitisePermissions,
  statement,
} from './statement'

describe('permission statement', () => {
  it('builds resource.action strings', () => {
    expect(permission('orders', 'refund')).toBe('orders.refund')
    expect(permissions.SETTINGS_MANAGE).toBe('settings.manage')
  })

  it('lists every action exactly once', () => {
    const expected = Object.entries(statement).reduce((n, [, actions]) => n + actions.length, 0)
    expect(ALL_PERMISSIONS).toHaveLength(expected)
    expect(new Set(ALL_PERMISSIONS).size).toBe(expected)
  })

  it('labels every resource', () => {
    for (const resource of Object.keys(statement)) {
      expect(RESOURCE_METADATA[resource as keyof typeof statement].label).toBeTruthy()
    }
  })

  it('rejects strings outside the statement', () => {
    expect(isPermission('orders.refund')).toBe(true)
    expect(isPermission('orders.destroy')).toBe(false)
    expect(isPermission('*.*')).toBe(false)
  })

  it('drops unknown and duplicate grants', () => {
    expect(sanitisePermissions(['orders.read', 'orders.read', 'nope.read'])).toEqual([
      'orders.read',
    ])
  })
})

describe('system roles', () => {
  it('gives the owner everything', () => {
    const owner = SYSTEM_ROLES.find((r) => r.slug === 'owner')
    expect(owner?.permissions).toEqual(ALL_PERMISSIONS)
  })

  it('keeps billing and staff management away from administrators', () => {
    const admin = SYSTEM_ROLES.find((r) => r.slug === 'admin')
    expect(admin?.permissions).not.toContain(permissions.BILLING_MANAGE)
    expect(admin?.permissions).not.toContain(permissions.STAFF_MANAGE)
    expect(admin?.permissions).toContain(permissions.SETTINGS_MANAGE)
  })

  it('limits staff to fulfilment work', () => {
    const staff = SYSTEM_ROLES.find((r) => r.slug === 'staff')
    expect(staff?.permissions).toContain(permissions.ORDERS_FULFIL)
    expect(staff?.permissions).not.toContain(permissions.SETTINGS_MANAGE)
    expect(staff?.permissions).not.toContain(permissions.PRODUCTS_WRITE)
  })

  it('reserves the built in slugs', () => {
    expect(isSystemRoleSlug('owner')).toBe(true)
    expect(isSystemRoleSlug('packer')).toBe(false)
  })

  it('slugifies role names', () => {
    expect(roleSlug('  Team Lead ')).toBe('team-lead')
    expect(roleSlug('Support / Returns')).toBe('support-returns')
  })
})
