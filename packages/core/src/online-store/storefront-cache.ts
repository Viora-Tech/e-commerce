/** SOURCE OF TRUTH: the storefront cache's store-side signals — WHAT: the listener for writes that change a store's pages (`listenStorefrontCache`, from @commerce/db) and the next future instant at which something a storefront page shows changes with no write (a product launches, a scheduled article goes live, a discount starts or ends) / WHY: the storefront caches pages until a write to a rendered table says otherwise (`storefront_cache` NOTIFY); a launch timer reaching zero writes nothing, so the cache also ends at this instant */
import { article, discount, product, type StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'

export { listenStorefrontCache, type StorefrontCacheHandlers } from '@commerce/db'

/** The next scheduled change for the store in scope (RLS), or null when nothing is scheduled. */
export async function nextScheduledChange(tx: StoreTx): Promise<Date | null> {
  const [row] = await tx.execute<{ at: string | null }>(sql`
    select least(
      (select min(${product.launchAt}) from ${product} where ${product.launchAt} > now()),
      (select min(${article.publishedAt}) from ${article} where ${article.publishedAt} > now()),
      (select min(${discount.startsAt}) from ${discount} where ${discount.startsAt} > now()),
      (select min(${discount.endsAt}) from ${discount} where ${discount.endsAt} > now())
    ) as at
  `)
  return row?.at ? new Date(row.at) : null
}
