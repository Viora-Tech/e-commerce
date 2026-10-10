import { settingsSecret } from '@commerce/config'
import {
  AVATAR_DATA_URL_MAX,
  checkRateLimit,
  createMemoryRateLimitStore,
  decodeAvatarDataUrl,
  InvalidAvatar,
  MemberProfileInputSchema,
  rateLimitKey,
  retryAfterSeconds,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { protectedProcedure, storeProcedureDetached } from '../procedures'
import {
  assertCanLeaveStore,
  forgetStoreMembership,
  LeaveStoreRefused,
  memberProfile,
  memberStores,
  removeMemberAvatar,
  setMemberAvatar,
  updateMemberProfile,
} from '../services/account.service'

/** In-process fallback, as in the other routers, for hosts that wire no shared store. */
const fallbackRateLimit = createMemoryRateLimitStore()

/** Photo changes per member: plenty for trying a few crops, too few to fill a bucket. */
const AVATAR_RULE = { limit: 20, windowMs: 60 * 60 * 1000 }

/**
 * Account: the signed-in member's own profile and stores (avatar menu → Account). Every
 * procedure acts on the caller only; nothing here needs a store permission, because nothing
 * here reads or changes store data beyond the caller's own membership.
 */
export const accountRouter = {
  profile: protectedProcedure.handler(async ({ context }) => {
    const profile = await memberProfile(context.db, context.session.user.id)
    if (!profile) throw new ORPCError('NOT_FOUND', { message: 'Account not found' })
    return profile
  }),

  updateProfile: protectedProcedure
    .input(MemberProfileInputSchema)
    .handler(({ context, input }) =>
      updateMemberProfile(context.db, context.session.user.id, input),
    ),

  /**
   * The cropped photo as a data URL. Stored in the active store's file storage (the same
   * place media uploads go), outside the media library. Detached: the upload must not hold a
   * transaction open.
   */
  setAvatar: storeProcedureDetached
    .input(z.object({ photo: z.string().max(AVATAR_DATA_URL_MAX) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id
      const limit = await checkRateLimit(
        context.rateLimit ?? fallbackRateLimit,
        rateLimitKey('member-avatar', userId),
        AVATAR_RULE,
      )
      if (!limit.ok) {
        throw new ORPCError('TOO_MANY_REQUESTS', {
          message: `Too many photo changes. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
        })
      }
      try {
        return await setMemberAvatar(context.db, {
          userId,
          storeId: context.scope.storeId,
          bytes: decodeAvatarDataUrl(input.photo),
          secret: settingsSecret(),
        })
      } catch (err) {
        if (err instanceof InvalidAvatar)
          throw new ORPCError('BAD_REQUEST', { message: err.message })
        throw err
      }
    }),

  removeAvatar: storeProcedureDetached.handler(({ context }) =>
    removeMemberAvatar(context.db, {
      userId: context.session.user.id,
      storeId: context.scope.storeId,
      secret: settingsSecret(),
    }),
  ),

  /** Every store the member belongs to, with their role and an owner flag. */
  stores: protectedProcedure.handler(({ context }) =>
    memberStores(context.db, context.session.user.id, context.session.activeOrganizationId),
  ),

  /**
   * Leaves a store: Better Auth drops the membership (and clears it as the active store),
   * then the member's staff row goes. Owners cannot leave; a store always keeps its owner.
   */
  leaveStore: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1).max(200) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id
      let storeId: string | null
      try {
        ;({ storeId } = await assertCanLeaveStore(context.db, userId, input.organizationId))
      } catch (err) {
        if (err instanceof LeaveStoreRefused) {
          throw new ORPCError(err.reason === 'owner' ? 'FORBIDDEN' : 'NOT_FOUND', {
            message: err.message,
          })
        }
        throw err
      }
      await context.auth.api
        .leaveOrganization({
          headers: context.headers,
          body: { organizationId: input.organizationId },
        })
        .catch((err: unknown) => {
          throw new ORPCError('BAD_REQUEST', {
            message: err instanceof Error ? err.message : 'Could not leave this store',
          })
        })
      if (storeId) await forgetStoreMembership(context.db, storeId, userId)
      return { wasActive: context.session.activeOrganizationId === input.organizationId }
    }),
}
