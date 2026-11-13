/** SOURCE OF TRUTH: the Delivery options app's sidebar counts — WHAT: how many options and product
 * rules the store has, for the Options and Product rules entries under the app in the sidebar
 * (Figma 929:11373) / WHY: the app bar read runs on every admin page, so it is one statement.
 * The status pill needs courier health from Redis, which this read cannot reach: the app's
 * header action draws it (`delivery-options/header-action.tsx`).
 */
import { deliveryOption, deliveryRouteRule } from '@commerce/db'
import type { AppBarContext, AppBarSummary } from '@commerce/plugins'
import { sql } from 'drizzle-orm'

export async function deliveryOptionsAppBar({
  tx,
  can,
}: Pick<AppBarContext, 'tx' | 'can'>): Promise<AppBarSummary | null> {
  if (!can('settings.read')) return null
  const [row] = await tx
    .select({
      options: sql<number>`count(*)::int`,
      rules: sql<number>`(select count(*) from ${deliveryRouteRule})::int`,
    })
    .from(deliveryOption)
  return { pageCounts: { options: Number(row?.options ?? 0), rules: Number(row?.rules ?? 0) } }
}
