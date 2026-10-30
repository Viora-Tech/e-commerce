import {
  createStepUpOtp,
  hasPasskey,
  isFresh,
  stepUpAgeMs,
  stepUpPasskeyOptions,
  verifyStepUpOtp,
  verifyStepUpPasskey,
} from '@commerce/auth'
import {
  checkRateLimit,
  createMemoryRateLimitStore,
  deliverPlatformLoginCode,
  getPlatformEmail,
  type RateLimitRule,
  rateLimitKey,
  retryAfterSeconds,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { protectedProcedure } from '../procedures'

/**
 * Step-up re-authentication (A5): the signed-in member re-verifies with an OTP or a passkey so a
 * sensitive action can run (the guard in `store.ts` throws `STEP_UP_REQUIRED` when a session is
 * stale). People-only — these run on `protectedProcedure`, so an access token or MCP never
 * reaches them (and the namespace is excluded from the MCP catalogue). Verifying stamps the SAME
 * session's `reauthenticated_at`; no new session is minted.
 */

const fallbackRateLimit = createMemoryRateLimitStore()
const MIN = 60 * 1000

/** Step-up codes requested per member. */
const OTP_SEND_RULE: RateLimitRule = { limit: 5, windowMs: 10 * MIN }
/** Tries at the code per member, on top of the core's own 5-attempt burn. */
const VERIFY_RULE: RateLimitRule = { limit: 10, windowMs: 10 * MIN }

async function limit(
  context: ApiContext,
  scope: string,
  userId: string,
  rule: RateLimitRule,
  message: (minutes: number) => string,
): Promise<void> {
  const result = await checkRateLimit(
    context.rateLimit ?? fallbackRateLimit,
    rateLimitKey(scope, userId),
    rule,
  )
  if (!result.ok) {
    throw new ORPCError('TOO_MANY_REQUESTS', {
      message: message(Math.ceil(retryAfterSeconds(result) / 60)),
    })
  }
}

/** The passkey rpID/origin, pinned from the admin's own URL — never read from the request. */
function relyingParty(context: ApiContext): { rpId: string; origin: string } {
  if (!context.appUrl) {
    throw new ORPCError('NOT_IMPLEMENTED', { message: 'Passkey step-up is unavailable here.' })
  }
  const url = new URL(context.appUrl)
  return { rpId: url.hostname, origin: url.origin }
}

export const reauthRouter = {
  /** What the dialog needs: which factor to offer, and whether a step-up is even needed now. */
  status: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id
    const method = (await hasPasskey(context.db, userId)) ? ('passkey' as const) : ('otp' as const)
    const fresh = isFresh(await stepUpAgeMs(context.db, context.session.sessionId))
    return { method, fresh }
  }),

  /** Mail a fresh step-up code to the member's own address. */
  sendOtp: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id
    await limit(
      context,
      'step-up-otp-send',
      userId,
      OTP_SEND_RULE,
      (m) => `Too many codes. Try again in about ${m} minute(s).`,
    )
    const code = await createStepUpOtp(context.db, userId)
    const sent = await deliverPlatformLoginCode(
      { email: context.session.user.email, code },
      context.platformEmail ?? getPlatformEmail(),
    )
    if (!sent) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', {
        message: 'Could not send the code. Try again in a minute.',
      })
    }
    return { ok: true as const }
  }),

  /** WebAuthn options for a passkey step-up; the challenge is kept server-side on the session. */
  passkeyOptions: protectedProcedure.handler(async ({ context }) => {
    const { rpId } = relyingParty(context)
    const { options } = await stepUpPasskeyOptions(context.db, {
      sessionId: context.session.sessionId,
      userId: context.session.user.id,
      rpId,
    })
    return options
  }),

  /** Verify an OTP or a passkey answer; on success the session is stamped re-authenticated. */
  verify: protectedProcedure
    .input(
      z.object({
        otp: z.string().min(1).max(12).optional(),
        passkeyResponse: z.unknown().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id
      const sessionId = context.session.sessionId
      if (input.otp) {
        await limit(
          context,
          'step-up-otp-verify',
          userId,
          VERIFY_RULE,
          (m) => `Too many tries. Try again in about ${m} minute(s).`,
        )
        const result = await verifyStepUpOtp(context.db, { sessionId, userId, otp: input.otp })
        if (!result.ok)
          throw new ORPCError('BAD_REQUEST', { message: 'That code is wrong or expired.' })
        return { ok: true as const }
      }
      if (input.passkeyResponse !== undefined) {
        const { rpId, origin } = relyingParty(context)
        const result = await verifyStepUpPasskey(context.db, {
          sessionId,
          userId,
          rpId,
          origin,
          response: input.passkeyResponse,
        })
        if (!result.ok)
          throw new ORPCError('BAD_REQUEST', { message: "That passkey didn't verify." })
        return { ok: true as const }
      }
      throw new ORPCError('BAD_REQUEST', { message: 'Provide an OTP or a passkey response.' })
    }),
}
