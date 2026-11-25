import { product } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { review } from './schema'

/**
 * A review the store-wide totals and walls may count: a store review (no product), or one of
 * an active product. Reviews of draft or archived products stay out (owner, 24 Nov 2026).
 */
export const onLiveProductSql = sql`(${review.productId} is null or exists (select 1 from ${product} where ${product.id} = ${review.productId} and ${product.status} = 'active'))`
