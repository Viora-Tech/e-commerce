import { AsyncLocalStorage } from 'node:async_hooks'
import { passkey } from '@better-auth/passkey'
import { siteConfig } from '@commerce/config/site'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, organization } from 'better-auth/plugins'
import { type ReviewerSignIn, reviewerPassword } from './reviewer'

export type SendOtp = (input: { email: string; otp: string; type: string }) => Promise<void>

export type SendInvite = (input: {
  email: string
  organizationName: string
  /** The store's own name, when the invite was sent through the API (`runInvite`). */
  storeName?: string | undefined
  /** The store role offered, e.g. "Staff", when known. */
  roleLabel?: string | undefined
  inviterEmail: string
  acceptUrl: string
}) => Promise<void>

/** What the API knows about an invite that Better Auth does not, and how its email went. */
type InviteScope = {
  storeName?: string | undefined
  roleLabel?: string | undefined
  /** Set when `sendInvite` threw: the invitation exists but its email did not go. */
  emailError?: string | undefined
}

const inviteScope = new AsyncLocalStorage<InviteScope>()

/**
 * Runs a Better Auth invite call (createInvitation, also with `resend`) with the store name and
 * role for the email, and reports whether the email went. Better Auth swallows errors thrown by
 * `sendInvitationEmail` (it only logs them), so this is the only way the caller can tell the
 * merchant "the invitation was created but the email did not go".
 */
export async function runInvite<T>(
  details: { storeName?: string | undefined; roleLabel?: string | undefined },
  fn: () => Promise<T>,
): Promise<{ result: T; emailError: string | null }> {
  const scope: InviteScope = { ...details }
  const result = await inviteScope.run(scope, fn)
  return { result, emailError: scope.emailError ?? null }
}

export type MerchantAuthOptions = {
  db: Db
  baseURL: string
  secret: string
  sendOtp: SendOtp
  /**
   * Staff invitation email. Defaults to a console line so dev needs no mailer. Throw when the
   * email could not be sent: `runInvite` reports it to the caller.
   */
  sendInvite?: SendInvite
  /** Extra origins allowed to call the auth API (the storefront, dev hosts). */
  trustedOrigins?: string[]
  /**
   * `TRUSTED_PROXY`: which client-IP header Better Auth may believe for its own rate limits
   * and session IPs. `none` (default) turns IP tracking off rather than trust a header any
   * client can send (security audit D-01).
   */
  trustedProxy?: 'cloudflare' | 'none'
  /**
   * Called after every sign-in (a new session) with what Account → Sign-in & security shows;
   * the admin writes it to the sign-in log (`recordMemberSignIn` in @commerce/core). A
   * failure is logged and never blocks the sign-in.
   */
  onSignIn?: (event: SignInEvent) => Promise<void>
  /**
   * "Continue with Google" (`merchantGoogleSignIn` in @commerce/config). Null or unset leaves
   * the provider out entirely, so `/sign-in/social` and `/callback/google` answer "not found".
   */
  google?: { clientId: string; clientSecret: string } | null | undefined
  /**
   * The app-store reviewer's password sign-in (`reviewerSignIn` in @commerce/config). Null or
   * unset leaves the endpoint out, so `/sign-in/reviewer-password` answers "not found".
   */
  reviewer?: ReviewerSignIn | null | undefined
}

/** One sign-in, as `onSignIn` receives it. */
export type SignInEvent = {
  userId: string
  sessionId: string
  /** The Better Auth endpoint that opened the session ("/sign-in/email-otp", "/passkey/…", "/callback/google"). */
  path: string | null | undefined
  ipAddress: string | null | undefined
  userAgent: string | null | undefined
  headers: Headers | undefined
  /** True behind Cloudflare (`trustedProxy`), the only time its location headers are believed. */
  trustLocation: boolean
}

/** The one social provider the admin offers, and the only one `validateMerchantUserInfo` passes. */
const GOOGLE = 'google'

/**
 * The endpoint path with its params filled in: Better Auth reports the route pattern
 * ("/callback/:id"), the sign-in log needs the provider ("/callback/google").
 */
function filledPath(
  path: string | undefined,
  params: Record<string, unknown> | undefined,
): string | undefined {
  return path?.replace(/:(\w+)/g, (match, name: string) => {
    const value = params?.[name]
    return typeof value === 'string' ? value : match
  })
}

type UserInfoCheck = {
  user: { emailVerified?: unknown }
  source: {
    method: string
    oauth?: { providerId: string; profile?: Record<string, unknown> | undefined } | undefined
  }
}

/**
 * Better Auth's `user.validateUserInfo` gate, run before a Google user is created, linked to an
 * existing member, or signed in again. Google itself must say the address is verified (the
 * `email_verified` claim, not only the mapped flag): an unverified Google address is no proof
 * of owning the inbox, and linking on it would hand that member's account over. Every
 * non-OAuth method (email OTP) passes untouched.
 */
export function validateMerchantUserInfo(
  data: UserInfoCheck,
): { error: string; errorDescription: string } | undefined {
  if (data.source.method !== 'oauth') return undefined
  if (data.source.oauth?.providerId !== GOOGLE) {
    return { error: 'provider_not_allowed', errorDescription: 'This sign-in method is off.' }
  }
  if (data.user.emailVerified !== true || data.source.oauth.profile?.email_verified !== true) {
    return {
      error: 'email_not_verified',
      errorDescription: 'Google has not verified this email address.',
    }
  }
  return undefined
}

/**
 * Platform-level auth for merchants and staff. Email OTP, a passkey or Google; the only password
 * is the optional app-store reviewer's (`reviewerPassword`), never stored in the database.
 * One organization = one store (store.organization_id). Better Auth owns these
 * tables; they carry no store_id and sit outside RLS on purpose.
 */
export function createMerchantAuth(opts: MerchantAuthOptions) {
  return betterAuth({
    baseURL: opts.baseURL,
    secret: opts.secret,
    trustedOrigins: opts.trustedOrigins ?? [],
    database: drizzleAdapter(opts.db, { provider: 'pg' }),
    emailAndPassword: { enabled: false },
    socialProviders: opts.google
      ? {
          google: {
            clientId: opts.google.clientId,
            clientSecret: opts.google.clientSecret,
            // Always show Google's account chooser, so a shared computer does not quietly
            // sign the next person in as whoever used Google there last.
            prompt: 'select_account',
            // The redirect flow only; the id-token sign-in (One Tap) is a second way in we
            // do not use.
            disableIdTokenSignIn: true,
            // `emailVerified` is the claim itself, strictly true. Google's photo URL is dropped
            // by the user create hook below.
            mapProfileToUser: (profile) => ({ emailVerified: profile.email_verified === true }),
          },
        }
      : {},
    account: {
      // Sign-in only: Google's tokens are never used, but Better Auth keeps them on the
      // account row, so they are encrypted with the auth secret.
      encryptOAuthTokens: true,
      // A Google sign-in joins the member with the same email only when Google says it is
      // verified (`validateMerchantUserInfo`) and the member's own email is verified (Better
      // Auth's default `requireLocalEmailVerified`). No trusted providers: trusting Google
      // would skip the verified check. `/link-social` is blocked in the admin route.
      accountLinking: {
        enabled: true,
        trustedProviders: [],
        allowDifferentEmails: false,
        updateUserInfoOnLink: false,
      },
    },
    user: {
      validateUserInfo: (data) => validateMerchantUserInfo(data),
    },
    advanced: {
      // Better Auth skips its origin and callback-URL checks when NODE_ENV is `test`; keep them
      // on everywhere, so the tests prove a sign-in is never sent back to another site.
      disableOriginCheck: false,
      ipAddress:
        opts.trustedProxy === 'cloudflare'
          ? { ipAddressHeaders: ['cf-connecting-ip'] }
          : { disableIpTracking: true },
    },
    databaseHooks: {
      session: {
        create: {
          // Account → Sign-in & security lists recent sign-ins. A failed write never blocks
          // the sign-in itself.
          after: async (session, ctx) => {
            if (!opts.onSignIn) return
            await opts
              .onSignIn({
                userId: session.userId,
                sessionId: session.id,
                path: filledPath(ctx?.path, ctx?.params),
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
                headers: ctx?.headers ?? ctx?.request?.headers,
                trustLocation: opts.trustedProxy === 'cloudflare',
              })
              .catch((err: unknown) =>
                logger.error('sign-in record failed', { userId: session.userId, error: err }),
              )
          },
        },
      },
      user: {
        create: {
          // A Google sign-up would otherwise store Google's photo URL as the new member's
          // picture. Photos only come from Account → Profile (see update below).
          before: async (data) => ({ data: { ...data, image: null } }),
        },
        update: {
          // A member's photo is set only by the admin API (`account.setAvatar`), which
          // re-encodes it into our own storage and writes the row directly. Better Auth's
          // client-callable update-user would otherwise let anyone point their `image` at any
          // URL, which their teammates' browsers then load from the staff list. Hooks can only
          // add fields, not drop one, so an update that carries a photo is refused whole.
          before: async (data) => (data.image === undefined ? undefined : false),
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        sendVerificationOTP: ({ email, otp, type }) => opts.sendOtp({ email, otp, type }),
        // Account → Sign-in & security → Change email: a code to the NEW address (type
        // `change-email`); the admin API wraps both steps with its own rate limit and the
        // notice to the old address.
        changeEmail: { enabled: true },
      }),
      // Passkeys (Account → Sign-in & security) and "Sign in with a passkey" on the login page.
      // The origin is pinned to the admin's own URL rather than read from the request.
      passkey({
        rpID: new URL(opts.baseURL).hostname,
        rpName: siteConfig.brand.name,
        origin: new URL(opts.baseURL).origin,
      }),
      organization({
        allowUserToCreateOrganization: true,
        organizationLimit: 10,
        membershipLimit: 50,
        sendInvitationEmail: async (data) => {
          const acceptUrl = `${opts.baseURL}/accept-invitation/${data.id}`
          const send =
            opts.sendInvite ??
            (async (i) => {
              console.log(`[invite] ${i.email} for ${i.organizationName}: ${i.acceptUrl}`)
            })
          const scope = inviteScope.getStore()
          try {
            await send({
              email: data.email,
              organizationName: data.organization.name,
              storeName: scope?.storeName,
              roleLabel: scope?.roleLabel,
              inviterEmail: data.inviter.user.email,
              acceptUrl,
            })
          } catch (err) {
            if (scope) scope.emailError = err instanceof Error ? err.message : String(err)
            throw err
          }
        },
      }),
      ...(opts.reviewer ? [reviewerPassword(opts.reviewer)] : []),
    ],
  })
}

export type MerchantAuth = ReturnType<typeof createMerchantAuth>
