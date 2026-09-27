import { loadEnv } from '@commerce/config'
import {
  BusinessProfileSchema,
  checkRateLimit,
  checkSignupGate,
  checkSlugAvailability,
  clientIp,
  consumeSignupInvite,
  createMemoryRateLimitStore,
  createStore,
  joinSignupWaitlist,
  OnboardingError,
  type RateLimitRule,
  rateLimitKey,
  retryAfterSeconds,
  WaitlistEntrySchema,
} from '@commerce/core'
import { SHOPIFY_IMPORT_ID } from '@commerce/plugin-shopify-import/client'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { protectedProcedure } from '../procedures'

const env = () => loadEnv(process.env)

/** Same in-process fallback as `store.ts`: the deployed admin wires a Redis-backed store. */
const fallbackRateLimit = createMemoryRateLimitStore()

/** Joining the waitlist is a one-off; a handful of tries an hour covers typos. */
const WAITLIST_RULE: RateLimitRule = { limit: 5, windowMs: 60 * 60_000 }

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
        /** Answers from the guided flow; optional so older clients still work. */
        profile: BusinessProfileSchema.optional(),
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
          profile: input.profile,
          installApps: input.profile?.sellsOn === 'shopify' ? [SHOPIFY_IMPORT_ID] : [],
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
        // Moving from Shopify: land on the importer (installed above) instead of Home.
        const nextPath = input.profile?.sellsOn === 'shopify' ? `/apps/${SHOPIFY_IMPORT_ID}` : '/'
        return { ...result, nextPath }
      } catch (err) {
        if (err instanceof OnboardingError) {
          throw new ORPCError(CODE[err.code], { message: err.message, data: { code: err.code } })
        }
        throw err
      }
    }),

  /**
   * Invite mode: leave your details so the platform can invite you later.
   * Rate-limited per person and per IP so the form can't be used to flood the list.
   */
  joinWaitlist: protectedProcedure
    .input(WaitlistEntrySchema)
    .handler(async ({ context, input }) => {
      const limiter = context.rateLimit ?? fallbackRateLimit
      for (const key of [context.session.user.id, clientIp(context.headers)]) {
        const limit = await checkRateLimit(
          limiter,
          rateLimitKey('signup-waitlist', key),
          WAITLIST_RULE,
        )
        if (!limit.ok) {
          throw new ORPCError('TOO_MANY_REQUESTS', {
            message: `Too many tries. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
          })
        }
      }
      await joinSignupWaitlist(context.db, input, { userId: context.session.user.id })
      return { ok: true as const }
    }),
}
