/** SOURCE OF TRUTH: who may read and fill in extra fields, per owner
 * WHAT:  For each owner type, the permission that reads its extra field values and the one that
 *        writes them: the same grain as the record they sit on (a customer's need customers
 *        access, an order's orders access, the shop's settings access).
 * WHY:   One table for the API guard and the admin card that hides Save for members who cannot.
 *        Making or changing the fields themselves is `content.manage_types` for every owner.
 * WHERE: API `metaobjects.metafields` / `setMetafields` / `metafieldDefinitions`; admin
 *        `MetafieldsCard`.
 */
import { type Permission, permissions } from '../permissions/statement'
import type { MetafieldOwnerType } from './schemas'

export const METAFIELD_OWNER_PERMISSIONS: Record<
  MetafieldOwnerType,
  { read: Permission; write: Permission }
> = {
  product: { read: permissions.PRODUCTS_READ, write: permissions.PRODUCTS_WRITE },
  variant: { read: permissions.PRODUCTS_READ, write: permissions.PRODUCTS_WRITE },
  collection: { read: permissions.PRODUCTS_READ, write: permissions.PRODUCTS_WRITE },
  customer: { read: permissions.CUSTOMERS_READ, write: permissions.CUSTOMERS_WRITE },
  order: { read: permissions.ORDERS_READ, write: permissions.ORDERS_WRITE },
  page: { read: permissions.ONLINE_STORE_READ, write: permissions.ONLINE_STORE_WRITE },
  article: { read: permissions.CONTENT_READ, write: permissions.CONTENT_WRITE },
  shop: { read: permissions.SETTINGS_READ, write: permissions.SETTINGS_MANAGE },
}

/** Every permission that reads some owner's extra fields, for `canAny`. */
export const METAFIELD_READ_PERMISSIONS: Permission[] = [
  ...new Set([
    ...Object.values(METAFIELD_OWNER_PERMISSIONS).map((p) => p.read),
    permissions.CONTENT_MANAGE_TYPES,
  ]),
]

/** Every permission that writes some owner's extra fields, for `canAny`. */
export const METAFIELD_WRITE_PERMISSIONS: Permission[] = [
  ...new Set(Object.values(METAFIELD_OWNER_PERMISSIONS).map((p) => p.write)),
]
