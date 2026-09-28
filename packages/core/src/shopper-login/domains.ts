/** SOURCE OF TRUTH: shopper login return hosts — WHAT: the hostnames a sign-in hand-off may return to for a store (its live domains, platform and custom) / WHY: the platform login domain must only ever send a session back to a domain the store has proved it owns, so there is no open redirect */
import { storeDomain } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'

/** The store's live hostnames. Pending or failed custom domains are not included. */
export async function storeLoginHosts(ctx: StoreContext): Promise<string[]> {
  const rows = await ctx.tx
    .select({ hostname: storeDomain.hostname })
    .from(storeDomain)
    .where(eq(storeDomain.status, 'active'))
  return rows.map((r) => r.hostname.toLowerCase())
}
