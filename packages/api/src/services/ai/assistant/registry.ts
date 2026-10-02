/**
 * Every tool the AI assistant has, and the permission each one needs. Read tools are offered
 * to a member only when their role holds the permission; propose tools likewise, and the
 * same permission is checked again when the merchant approves or undoes the action.
 *
 * Add an action: write `actions/<name>.ts` with `defineAction`, then add it to `ACTIONS`.
 */
import {
  type Permission,
  type ProductFieldsSnapshot,
  permissions,
  restoreProductFields,
} from '@commerce/core'
import { collectionAction } from './actions/collection'
import { discountAction } from './actions/discount'
import { orderNoteAction } from './actions/order-note'
import { priceChangeAction } from './actions/price-change'
import { productUpdateAction } from './actions/product-update'
import { ProposalProblem } from './actions/resolve'
import type { ActionDefinition, ActionEnv } from './actions/types'

/** Write tools: each proposes, and runs only after the merchant approves. */
export const ACTIONS: Record<string, ActionDefinition> = Object.fromEntries(
  [discountAction, collectionAction, priceChangeAction, productUpdateAction, orderNoteAction].map(
    (a) => [a.tool, a],
  ),
)

/** Read tools and the permission each needs. */
export const READ_TOOL_PERMISSION: Record<string, Permission> = {
  salesSummary: permissions.ANALYTICS_READ,
  topProducts: permissions.ANALYTICS_READ,
  abandonedCheckouts: permissions.ORDERS_READ,
  pendingOrders: permissions.ORDERS_READ,
  orderDetails: permissions.ORDERS_READ,
  lowStock: permissions.INVENTORY_READ,
  findProducts: permissions.PRODUCTS_READ,
  productDetails: permissions.PRODUCTS_READ,
  listCollections: permissions.PRODUCTS_READ,
}

/** A member may open the assistant when their role allows at least one of its tools. */
export const ASSISTANT_PERMISSIONS: readonly Permission[] = [
  ...new Set([
    ...Object.values(READ_TOOL_PERMISSION),
    ...Object.values(ACTIONS).map((a) => a.permission),
  ]),
]

/** Actions logged by other AI features that only need an undo (bulk "Write with AI" applies). */
const UNDO_ONLY: Record<string, Pick<ActionDefinition, 'permission' | 'undo'>> = {
  applyProductCopy: {
    permission: permissions.PRODUCTS_WRITE,
    undo: async (env: ActionEnv, undo: unknown) => {
      const { snapshots } = undo as { snapshots: ProductFieldsSnapshot[] }
      const n = await restoreProductFields(env.tx, env.storeId, snapshots)
      if (!n) throw new ProposalProblem('Those products no longer exist.')
      return n === 1
        ? 'Previous text put back on 1 product'
        : `Previous text put back on ${n} products`
    },
  },
}

/** The permission and undo step for any logged action's tool, or null for an unknown tool. */
export function undoerFor(tool: string): Pick<ActionDefinition, 'permission' | 'undo'> | null {
  return ACTIONS[tool] ?? UNDO_ONLY[tool] ?? null
}

/** Every permission an action in the log may need (approve and undo gates). */
export const ACTION_PERMISSIONS: readonly Permission[] = [
  ...new Set([...Object.values(ACTIONS), ...Object.values(UNDO_ONLY)].map((a) => a.permission)),
]
