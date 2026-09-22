import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { base, protectedProcedure } from '../procedures'
import {
  acceptInvitation,
  InvitationError,
  previewInvitation,
} from '../services/invitation.service'

const byId = z.object({ id: z.string().min(1).max(200) })

const CODE = {
  missing: 'NOT_FOUND',
  not_pending: 'BAD_REQUEST',
  expired: 'BAD_REQUEST',
  wrong_email: 'FORBIDDEN',
} as const

/** Joining a store from an emailed invitation. */
export const invitationsRouter = {
  /** Public: the accept page shows the store, inviter and role before sign in. */
  preview: base
    .input(byId)
    .handler(({ context, input }) => previewInvitation(context.db, input.id)),

  /** Signed in as the invited email: grants the invited role and joins the store. */
  accept: protectedProcedure.input(byId).handler(async ({ context, input }) => {
    try {
      const joined = await acceptInvitation({
        db: context.db,
        invitationId: input.id,
        user: context.session.user,
        joinOrganization: async () => {
          await context.auth.api.acceptInvitation({
            headers: context.headers,
            body: { invitationId: input.id },
          })
        },
      })
      // Also set it here so the stored session is right; the browser still has to
      // call organization.setActive itself, because the session cookie cache is
      // refreshed by that response and not by this one.
      await context.auth.api.setActiveOrganization({
        headers: context.headers,
        body: { organizationId: joined.organizationId },
      })
      return { storeId: joined.storeId, organizationId: joined.organizationId }
    } catch (err) {
      if (err instanceof InvitationError) {
        throw new ORPCError(CODE[err.reason], {
          message: err.message,
          data: { reason: err.reason },
        })
      }
      throw new ORPCError('BAD_REQUEST', { message: (err as Error).message })
    }
  }),
}
