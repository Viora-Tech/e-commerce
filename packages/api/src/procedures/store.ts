import type { StoreTx } from '@commerce/db'
import { resolveStoreForOrganization, withStore } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { protectedProcedure } from './base'

export type StoreScope = { storeId: string; organizationId: string; role: string }

/**
 * Requires an active organization the user belongs to, resolves it to a store,
 * and runs the handler inside `withStore` so every query is tenant-scoped.
 * Membership is checked through Better Auth, never trusted from the client.
 */
export const storeProcedure = protectedProcedure.use(async ({ context, next }) => {
  const organizationId = context.session.activeOrganizationId
  if (!organizationId) throw new ORPCError('PRECONDITION_FAILED', { message: 'Pick a store first' })

  const org = await context.auth.api.getFullOrganization({
    headers: context.headers,
    query: { organizationId },
  })
  const membership = org?.members.find((m) => m.userId === context.session.user.id)
  if (!membership) throw new ORPCError('FORBIDDEN', { message: 'Not a member of this store' })

  const storeId = await resolveStoreForOrganization(context.db, organizationId)
  if (!storeId) throw new ORPCError('NOT_FOUND', { message: 'No store for this organization' })

  const scope: StoreScope = { storeId, organizationId, role: membership.role }
  return withStore(
    context.db,
    storeId,
    async (tx: StoreTx) => await next({ context: { scope, tx } }),
  )
})
