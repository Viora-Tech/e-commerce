import { ALL_PERMISSIONS, type Permission, permissions } from './statement'

export type SystemRoleSlug = 'owner' | 'admin' | 'staff'

export type SystemRole = {
  slug: SystemRoleSlug
  name: string
  description: string
  permissions: Permission[]
}

/** Everything except the two that let a member reshape the store's access or spend money. */
const ADMIN_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(
  (p) => p !== permissions.BILLING_MANAGE && p !== permissions.STAFF_MANAGE,
)

/** Day to day fulfilment work: orders and drafts, stock, read-only everywhere else. */
const STAFF_PERMISSIONS: Permission[] = [
  permissions.ORDERS_READ,
  permissions.ORDERS_WRITE,
  permissions.ORDERS_FULFIL,
  permissions.DRAFTS_READ,
  permissions.DRAFTS_WRITE,
  permissions.PRODUCTS_READ,
  permissions.INVENTORY_READ,
  permissions.INVENTORY_WRITE,
  permissions.CUSTOMERS_READ,
  permissions.ANALYTICS_READ,
  permissions.AUTOMATIONS_READ,
]

/** Seeded into every new store. `owner` is granted implicitly, never by row. */
export const SYSTEM_ROLES: SystemRole[] = [
  {
    slug: 'owner',
    name: 'Owner',
    description: 'Full access, including billing and staff.',
    permissions: ALL_PERMISSIONS,
  },
  {
    slug: 'admin',
    name: 'Administrator',
    description: 'Runs the store day to day. Cannot change billing or manage staff roles.',
    permissions: ADMIN_PERMISSIONS,
  },
  {
    slug: 'staff',
    name: 'Staff',
    description: 'Works orders and stock. Read-only elsewhere.',
    permissions: STAFF_PERMISSIONS,
  },
]

export const SYSTEM_ROLE_SLUGS: SystemRoleSlug[] = SYSTEM_ROLES.map((r) => r.slug)

/** True for slugs a merchant may not rename, re-permission or delete. */
export function isSystemRoleSlug(slug: string): slug is SystemRoleSlug {
  return (SYSTEM_ROLE_SLUGS as string[]).includes(slug)
}

/** `Team lead` becomes `team-lead`; used for the per-store unique key. */
export function roleSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
