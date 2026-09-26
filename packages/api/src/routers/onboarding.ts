import { loadEnv } from '@commerce/config'
import {
  checkSignupGate,
  checkSlugAvailability,
  consumeSignupInvite,
  createStore,
  OnboardingError,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { protectedProcedure } from '../procedures'

const env = () => loadEnv(process.env)

const CODE = {
  SLUG_INVALID: 'BAD_REQUEST',
  SLUG_RESERVED: 'BAD_REQUEST',
  SLUG_TAKEN: 'BAD_REQUEST',
} as const

/** Creating your own store, once signed in. See `packages/core/src/onboarding`. */
export const onboardingRouter = {
  /** Live check while typing the store address. */
  slugAvailability: protectedProcedure
    .input(z.object({ slug: z.string().trim().toLowerCase().min(1).max(60) }))
    .handler(({ context, input }) => checkSlugAvailability(context.db, input.slug)),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().toLowerCase().min(1).max(60),
      }),
    )
    .handler(async ({ context, input }) => {
      const orgs = await context.auth.api.listOrganizations({ headers: context.headers })
      const ownsAStoreAlready = orgs.length > 0
      const decision = await checkSignupGate(context.db, {
        email: context.session.user.email,
        mode: env().MERCHANT_SIGNUP_MODE,
        ownsAStoreAlready,
      })
      if (!decision.allowed) {
        throw new ORPCError('FORBIDDEN', { message: 'Signups are invite-only for now' })
      }

      try {
        const result = await createStore({
          db: context.db,
          ownerUserId: context.session.user.id,
          name: input.name,
          slug: input.slug,
          platformDomain: env().PLATFORM_STORE_DOMAIN,
          addLocalhostDomain: process.env.NODE_ENV !== 'production',
          createOrganization: async ({ name, slug }) => {
            const org = await context.auth.api.createOrganization({
              headers: context.headers,
              body: { name, slug },
            })
            if (!org) throw new Error('createOrganization returned nothing')
            return { organizationId: org.id }
          },
        })
        if (decision.invite) await consumeSignupInvite(context.db, decision.invite.id)
        await context.auth.api.setActiveOrganization({
          headers: context.headers,
          body: { organizationId: result.organizationId },
        })
        return result
      } catch (err) {
        if (err instanceof OnboardingError) {
          throw new ORPCError(CODE[err.code], { message: err.message, data: { code: err.code } })
        }
        throw err
      }
    }),
}
