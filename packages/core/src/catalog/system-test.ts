/** SOURCE OF TRUTH: system test product exclusion — WHAT filters out `product.isSystemTest` rows (the payments-setup ₹1 test product) / WHY every listing, search, collection, storefront, analytics and inventory query must hide it while direct id/handle lookups (the test-checkout flow itself) keep working */
import { product } from '@commerce/db'
import { eq, type SQL } from 'drizzle-orm'

/** Where-clause fragment: true for rows that are NOT a system test fixture. */
export const notSystemTest: SQL = eq(product.isSystemTest, false)
