import { normaliseAccent } from '@commerce/core/admin-accent'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { type StoreScope, storeProcedure } from '../procedures'
import { loadAccentChoice, setMemberAccent, setStoreAccent } from '../services/appearance.service'

/** A hex colour (`#2563eb`, `#abc`), or null to clear the choice. Anything else is refused. */
const AccentInput = z.object({
  accent: z
    .string()
    .max(16)
    .nullable()
    .refine((v) => v === null || normaliseAccent(v) !== null, {
      message: 'Enter a colour as a hex code, like #2563eb',
    }),
})

async function present(tx: StoreTx, scope: StoreScope) {
  const choice = await loadAccentChoice(tx, scope.storeId, scope.userId)
  return {
    ...choice,
    /** What this member sees: their own pick, else the store default, else null (Ocean Green). */
    effective: choice.mine ?? choice.storeDefault,
    storeId: scope.storeId,
    /** The admin keys its first-paint accent cookie on this: the session names the organization. */
    organizationId: scope.organizationId,
    canSetStoreDefault: scope.isOwner,
  }
}

/**
 * Admin accent colour. Every member may pick their own; the owner's store default covers
 * members who have not. Any store member may call these, so there is no permission gate
 * beyond membership; the store default is owner-only.
 */
export const appearanceRouter = {
  get: storeProcedure.handler(({ context }) => present(context.tx, context.scope)),

  setMine: storeProcedure.input(AccentInput).handler(async ({ context, input }) => {
    const { storeId, userId } = context.scope
    await setMemberAccent(context.tx, storeId, userId, normaliseAccent(input.accent))
    return present(context.tx, context.scope)
  }),

  setStoreDefault: storeProcedure.input(AccentInput).handler(async ({ context, input }) => {
    if (!context.scope.isOwner) {
      throw new ORPCError('FORBIDDEN', { message: 'Only the store owner can set the default' })
    }
    await setStoreAccent(context.tx, context.scope.storeId, normaliseAccent(input.accent))
    return present(context.tx, context.scope)
  }),
}
