import { loadEnv, merchantGoogleSignIn, settingsSecret } from '@commerce/config'
import {
  AVATAR_DATA_URL_MAX,
  checkRateLimit,
  createMemoryRateLimitStore,
  decodeAvatarDataUrl,
  deliverPlatformAccountDeletionCode,
  deliverPlatformEmailChanged,
  getPlatformEmail,
  InvalidAvatar,
  loadMemberAlertPrefs,
  MemberAlertPrefsInputSchema,
  MemberProfileInputSchema,
  type RateLimitRule,
  rateLimitKey,
  retryAfterSeconds,
  saveMemberAlertPrefs,
} from '@commerce/core'
import { logger } from '@commerce/observability/logging'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import type { ApiContext } from '../context'
import { protectedProcedure, storeProcedure, storeProcedureDetached } from '../procedures'
import {
  assertCanLeaveStore,
  deleteMemberAccount,
  describeSessions,
  forgetStoreMembership,
  googleLinkedAt,
  LeaveStoreRefused,
  memberProfile,
  memberStores,
  memberStoresWithApp,
  ownedStoreNames,
  recentSignIns,
  removeMemberAvatar,
  sessionTokenFor,
  setMemberAvatar,
  storeHasWhatsapp,
  updateMemberProfile,
} from '../services/account.service'
import { storeNameOf } from '../services/staff-invites.service'

/** In-process fallback, as in the other routers, for hosts that wire no shared store. */
const fallbackRateLimit = createMemoryRateLimitStore()

const HOUR = 60 * 60 * 1000

/** Photo changes per member: plenty for trying a few crops, too few to fill a bucket. */
const AVATAR_RULE = { limit: 20, windowMs: HOUR }

/** Codes to a new email per member: a few typos' worth, not a mail cannon. */
const EMAIL_CODE_RULE = { limit: 5, windowMs: HOUR }

/** Tries at the code per member, on top of Better Auth's 3 tries per code. */
const EMAIL_CONFIRM_RULE = { limit: 10, windowMs: HOUR }

/** Account deletion codes per member. */
const DELETE_CODE_RULE = { limit: 3, windowMs: HOUR }

/** Better Auth's OTP store namespace the deletion code lives in; it never signs anyone in. */
const DELETE_CODE_TYPE = 'email-verification' as const

/** While they own a store the account stays: a store always keeps its owner. */
function ownsStores(names: string[]): never {
  throw new ORPCError('FORBIDDEN', {
    message: `You own ${names.join(', ')}. Hand ${names.length === 1 ? 'it' : 'them'} over or close ${names.length === 1 ? 'it' : 'them'} before deleting your account.`,
  })
}

/** Refuses with a plain "try again in N minutes" once `rule` is used up for this member. */
async function limit(
  context: ApiContext,
  scope: string,
  userId: string,
  rule: RateLimitRule,
  message: (minutes: number) => string,
) {
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

/** Better Auth's own refusals ("Invalid OTP", "Email already in use") as a 400 the page shows. */
function authRefusal(fallback: string) {
  return (err: unknown): never => {
    const message = err instanceof Error && err.message ? err.message : fallback
    throw new ORPCError('BAD_REQUEST', { message })
  }
}

/**
 * Account: the signed-in member's own profile, stores, sign-in and devices (avatar menu →
 * Account). Every procedure acts on the caller only; nothing here needs a store permission,
 * because nothing here reads or changes store data beyond the caller's own membership.
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
      await limit(
        context,
        'member-avatar',
        userId,
        AVATAR_RULE,
        (m) => `Too many photo changes. Try again in about ${m} minute(s).`,
      )
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

  /** Which of the member's stores already have an app, for the install store picker. */
  storesWithApp: protectedProcedure
    .input(z.object({ appId: z.string().min(1).max(200) }))
    .handler(({ context, input }) =>
      memberStoresWithApp(context.db, context.session.user.id, input.appId),
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
        .catch(authRefusal('Could not leave this store'))
      if (storeId) await forgetStoreMembership(context.db, storeId, userId)
      return { wasActive: context.session.activeOrganizationId === input.organizationId }
    }),

  /**
   * Sign-in & security: the email they sign in with, whether Google is linked (and whether
   * the admin offers Google at all), and their latest sign-ins (masked IPs).
   */
  security: protectedProcedure.handler(async ({ context }) => ({
    email: context.session.user.email,
    google: {
      available: merchantGoogleSignIn(loadEnv(process.env)) !== null,
      linkedAt: await googleLinkedAt(context.db, context.session.user.id),
    },
    recentSignIns: await recentSignIns(
      context.db,
      context.session.user.id,
      context.session.sessionId,
    ),
  })),

  /**
   * Change email, step 1: Better Auth emails a code to the NEW address. When that address
   * already has an account Better Auth answers the same but sends nothing, so nobody can probe
   * which emails are taken.
   */
  requestEmailChange: protectedProcedure
    .input(z.object({ newEmail: z.email().max(254) }))
    .handler(async ({ context, input }) => {
      const newEmail = input.newEmail.trim().toLowerCase()
      if (newEmail === context.session.user.email.toLowerCase()) {
        throw new ORPCError('BAD_REQUEST', { message: 'That is already your email.' })
      }
      await limit(
        context,
        'member-email-code',
        context.session.user.id,
        EMAIL_CODE_RULE,
        (m) => `Too many codes asked for. Try again in about ${m} minute(s).`,
      )
      await context.auth.api
        .requestEmailChangeEmailOTP({ headers: context.headers, body: { newEmail } })
        .catch(authRefusal('Could not send the code. Try again in a minute.'))
      return { sentTo: newEmail }
    }),

  /**
   * Change email, step 2: the code from the new inbox switches the sign-in email, then the
   * OLD address is told (masked new address, "if this was not you"). The notice is best
   * effort: the change has already happened.
   */
  confirmEmailChange: protectedProcedure
    .input(
      z.object({
        newEmail: z.email().max(254),
        otp: z
          .string()
          .trim()
          .regex(/^\d{6}$/, 'Enter the 6-digit code'),
      }),
    )
    .handler(async ({ context, input }) => {
      const oldEmail = context.session.user.email
      const newEmail = input.newEmail.trim().toLowerCase()
      await limit(
        context,
        'member-email-confirm',
        context.session.user.id,
        EMAIL_CONFIRM_RULE,
        (m) => `Too many tries. Try again in about ${m} minute(s).`,
      )
      await context.auth.api
        .changeEmailEmailOTP({ headers: context.headers, body: { newEmail, otp: input.otp } })
        .catch(authRefusal('That code did not work. Check it and try again.'))
      const notice = await deliverPlatformEmailChanged(
        { oldEmail, newEmail },
        context.platformEmail ?? getPlatformEmail(),
      ).catch(() => 'refused' as const)
      if (notice !== 'sent') {
        logger.warn('email-changed notice not sent', {
          userId: context.session.user.id,
          result: notice,
        })
      }
      return { email: newEmail }
    }),

  /** Every browser signed in as this member, this one first. No session token leaves the server. */
  sessions: protectedProcedure.handler(async ({ context }) => {
    const sessions = await context.auth.api.listSessions({ headers: context.headers })
    return describeSessions(
      context.db,
      context.session.user.id,
      sessions,
      context.session.sessionId,
    )
  }),

  /** Signs one other device out. This browser signs out from the account menu instead. */
  revokeSession: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(200) }))
    .handler(async ({ context, input }) => {
      if (input.id === context.session.sessionId) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Use Log out in the account menu to sign out of this device.',
        })
      }
      const token = await sessionTokenFor(context.db, context.session.user.id, input.id)
      if (!token) {
        throw new ORPCError('NOT_FOUND', { message: 'That device is already signed out.' })
      }
      await context.auth.api
        .revokeSession({ headers: context.headers, body: { token } })
        .catch(authRefusal('Could not sign that device out. Try again.'))
      return { ok: true as const }
    }),

  /** Signs every other device out; this browser stays signed in. */
  revokeOtherSessions: protectedProcedure.handler(async ({ context }) => {
    await context.auth.api
      .revokeOtherSessions({ headers: context.headers })
      .catch(authRefusal('Could not sign the other devices out. Try again.'))
    return { ok: true as const }
  }),

  /**
   * Notifications: the member's own alerts for the store they are in, whether the store can
   * send WhatsApp, whether they gave a mobile for it, and whether this server takes bug reports
   * (the "Your bug reports" row shows only then).
   */
  notifications: storeProcedure.handler(async ({ context }) => {
    const { storeId, userId, isOwner } = context.scope
    const prefs = await loadMemberAlertPrefs(context.tx, storeId, userId, isOwner)
    const whatsappAvailable = await storeHasWhatsapp(context.tx, storeId, settingsSecret())
    const profile = await memberProfile(context.db, userId)
    const storeName = (await storeNameOf(context.tx, storeId)) ?? ''
    return {
      storeName,
      prefs,
      whatsappAvailable,
      hasPhone: Boolean(profile?.phone),
      bugReports: loadEnv(process.env).BUG_REPORTS_ENABLED,
    }
  }),

  /** Saves the member's own alerts for this store, on their own staff row only. */
  updateNotifications: storeProcedure
    .input(MemberAlertPrefsInputSchema)
    .handler(({ context, input }) =>
      saveMemberAlertPrefs(
        context.tx,
        context.scope.storeId,
        context.scope.userId,
        context.scope.isOwner,
        input,
      ),
    ),

  /** Delete my account, step 0: whether anything blocks it (stores they own). */
  deletion: protectedProcedure.handler(async ({ context }) => ({
    email: context.session.user.email,
    ownedStores: await ownedStoreNames(context.db, context.session.user.id),
  })),

  /**
   * Delete my account, step 1: a 6-digit code to their sign-in email. Refused while they own
   * a store. Without a platform email account (development only) the code is printed.
   */
  sendDeletionCode: protectedProcedure.handler(async ({ context }) => {
    const { id, email } = context.session.user
    const owned = await ownedStoreNames(context.db, id)
    if (owned.length) ownsStores(owned)
    await limit(
      context,
      'member-delete-code',
      id,
      DELETE_CODE_RULE,
      (m) => `Too many codes asked for. Try again in about ${m} minute(s).`,
    )
    const code = await context.auth.api.createVerificationOTP({
      body: { email, type: DELETE_CODE_TYPE },
    })
    const sent = await deliverPlatformAccountDeletionCode(
      { email, code },
      context.platformEmail ?? getPlatformEmail(),
    )
    if (!sent) {
      if (process.env.NODE_ENV === 'production') {
        throw new ORPCError('INTERNAL_SERVER_ERROR', {
          message: 'Could not send the code. Try again in a minute.',
        })
      }
      console.log(`[otp] account deletion code for ${email}: ${code}`)
    }
    return { sentTo: email }
  }),

  /**
   * Delete my account, step 2: their email typed out and the code. Removes every staff row,
   * their photo and the user (sessions, passkeys and memberships go with it).
   */
  deleteAccount: protectedProcedure
    .input(
      z.object({
        email: z.string().trim().max(254),
        otp: z
          .string()
          .trim()
          .regex(/^\d{6}$/, 'Enter the 6-digit code'),
      }),
    )
    .handler(async ({ context, input }) => {
      const { id, email } = context.session.user
      if (input.email.toLowerCase() !== email.toLowerCase()) {
        throw new ORPCError('BAD_REQUEST', { message: 'Type your sign-in email exactly.' })
      }
      const owned = await ownedStoreNames(context.db, id)
      if (owned.length) ownsStores(owned)
      await context.auth.api
        .checkVerificationOTP({ body: { email, type: DELETE_CODE_TYPE, otp: input.otp } })
        .catch(authRefusal('That code did not work. Check it and try again.'))
      await deleteMemberAccount(context.db, id, settingsSecret())
      return { ok: true as const }
    }),
}
