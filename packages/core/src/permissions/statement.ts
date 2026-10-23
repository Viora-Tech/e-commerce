/**
 * Every permission the admin can grant, in one place.
 *
 * Adding an action here makes it type-checked at every call site and makes it
 * appear in the role editor automatically, because both the guard and the UI
 * read this file. Pure module: client components import it through
 * `@commerce/core/permissions`, so nothing here may touch the database.
 */
export const statement = {
  orders: ['read', 'write', 'refund', 'cancel', 'fulfil'],
  drafts: ['read', 'write'],
  products: ['read', 'write', 'delete', 'import'],
  inventory: ['read', 'write'],
  customers: ['read', 'write', 'delete'],
  discounts: ['read', 'write'],
  marketing: ['read', 'write', 'send'],
  automations: ['read', 'write', 'publish', 'run'],
  content: ['read', 'write', 'manage_types'],
  analytics: ['read'],
  online_store: ['read', 'write', 'publish'],
  apps: ['manage'],
  settings: ['read', 'manage'],
  staff: ['read', 'invite', 'manage'],
  billing: ['manage'],
} as const

export type Resource = keyof typeof statement
export type Action<R extends Resource> = (typeof statement)[R][number]
export type Permission = {
  [R in Resource]: `${R}.${Action<R>}`
}[Resource]

/** Builds a permission string with both halves checked at compile time. */
export function permission<R extends Resource>(
  resource: R,
  action: Action<R>,
): `${R}.${Action<R>}` {
  return `${resource}.${action}` as `${R}.${Action<R>}`
}

/** Named constants so call sites read as prose and typos fail the build. */
export const permissions = {
  ORDERS_READ: permission('orders', 'read'),
  ORDERS_WRITE: permission('orders', 'write'),
  ORDERS_REFUND: permission('orders', 'refund'),
  ORDERS_CANCEL: permission('orders', 'cancel'),
  ORDERS_FULFIL: permission('orders', 'fulfil'),
  DRAFTS_READ: permission('drafts', 'read'),
  DRAFTS_WRITE: permission('drafts', 'write'),
  PRODUCTS_READ: permission('products', 'read'),
  PRODUCTS_WRITE: permission('products', 'write'),
  PRODUCTS_DELETE: permission('products', 'delete'),
  PRODUCTS_IMPORT: permission('products', 'import'),
  INVENTORY_READ: permission('inventory', 'read'),
  INVENTORY_WRITE: permission('inventory', 'write'),
  CUSTOMERS_READ: permission('customers', 'read'),
  CUSTOMERS_WRITE: permission('customers', 'write'),
  CUSTOMERS_DELETE: permission('customers', 'delete'),
  DISCOUNTS_READ: permission('discounts', 'read'),
  DISCOUNTS_WRITE: permission('discounts', 'write'),
  MARKETING_READ: permission('marketing', 'read'),
  MARKETING_WRITE: permission('marketing', 'write'),
  MARKETING_SEND: permission('marketing', 'send'),
  /** See workflows, runs and record history. */
  AUTOMATIONS_READ: permission('automations', 'read'),
  /** Edit drafts and run dry tests ("Test with a record"). */
  AUTOMATIONS_WRITE: permission('automations', 'write'),
  /** Turn workflows on or off, publish versions, retry or cancel runs. */
  AUTOMATIONS_PUBLISH: permission('automations', 'publish'),
  /** "Run automation" on a record or a selection (plus each action's own permission). */
  AUTOMATIONS_RUN: permission('automations', 'run'),
  CONTENT_READ: permission('content', 'read'),
  CONTENT_WRITE: permission('content', 'write'),
  /** Add, change and delete content types and extra fields (their entries and values need write). */
  CONTENT_MANAGE_TYPES: permission('content', 'manage_types'),
  ANALYTICS_READ: permission('analytics', 'read'),
  ONLINE_STORE_READ: permission('online_store', 'read'),
  ONLINE_STORE_WRITE: permission('online_store', 'write'),
  ONLINE_STORE_PUBLISH: permission('online_store', 'publish'),
  APPS_MANAGE: permission('apps', 'manage'),
  SETTINGS_READ: permission('settings', 'read'),
  SETTINGS_MANAGE: permission('settings', 'manage'),
  STAFF_READ: permission('staff', 'read'),
  STAFF_INVITE: permission('staff', 'invite'),
  STAFF_MANAGE: permission('staff', 'manage'),
  BILLING_MANAGE: permission('billing', 'manage'),
} as const

type ResourceMeta = { label: string; description: string }

/**
 * Labels for the role editor. Typed against the statement on purpose: adding a
 * resource without copy is a type error rather than a blank switch in the UI.
 */
export const RESOURCE_METADATA: { [R in Resource]: ResourceMeta } = {
  orders: { label: 'Orders', description: 'View orders, edit them, refund, cancel and fulfil.' },
  drafts: { label: 'Draft orders', description: 'Create and edit draft orders and send invoices.' },
  products: {
    label: 'Products',
    description: 'View the catalogue, edit products, delete them and run imports.',
  },
  inventory: { label: 'Inventory', description: 'View stock levels and adjust quantities.' },
  customers: { label: 'Customers', description: 'View customer records, edit and delete them.' },
  discounts: { label: 'Discounts', description: 'View and edit discount codes and offers.' },
  marketing: {
    label: 'Marketing',
    description: 'View marketing reports, edit campaigns and automations, and send them.',
  },
  automations: {
    label: 'Automations',
    description: 'View workflows and runs, edit and publish workflows, and run them on records.',
  },
  content: {
    label: 'Content',
    description:
      'View and edit files and content entries, and manage content types and extra fields.',
  },
  analytics: { label: 'Analytics', description: 'View reports and the live view.' },
  online_store: {
    label: 'Online store',
    description: 'View and edit pages, themes and navigation, and publish changes.',
  },
  apps: { label: 'Apps', description: 'Install and uninstall apps for this store.' },
  settings: { label: 'Settings', description: 'View store settings and change them.' },
  staff: { label: 'Staff', description: 'View the team, invite people and manage roles.' },
  billing: { label: 'Billing', description: 'Manage the subscription and payment method.' },
} as const

/** Every permission string, in statement order. Owners hold all of these. */
export const ALL_PERMISSIONS: Permission[] = Object.entries(statement).flatMap(
  ([resource, actions]) =>
    (actions as readonly string[]).map((a) => `${resource}.${a}` as Permission),
)

const ALL = new Set<string>(ALL_PERMISSIONS)

/** True when the string is a permission this build knows about. */
export function isPermission(value: string): value is Permission {
  return ALL.has(value)
}

/** Drops anything not in the statement, so a stale or forged list cannot grant access. */
export function sanitisePermissions(values: readonly string[]): Permission[] {
  const seen = new Set<Permission>()
  for (const v of values) if (isPermission(v)) seen.add(v)
  return ALL_PERMISSIONS.filter((p) => seen.has(p))
}
