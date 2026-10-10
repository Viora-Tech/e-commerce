import { AsyncLocalStorage } from 'node:async_hooks'
import { passkey } from '@better-auth/passkey'
import { siteConfig } from '@commerce/config/site'
import type { Db } from '@commerce/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, organization } from 'better-auth/plugins'

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
}

/** One sign-in, as `onSignIn` receives it. */
export type SignInEvent = {
  userId: string
  sessionId: string
  /** The Better Auth endpoint that opened the session ("/sign-in/email-otp", "/passkey/…"). */
  path: string | null | undefined
  ipAddress: string | null | undefined
  userAgent: string | null | undefined
  headers: Headers | undefined
  /** True behind Cloudflare (`trustedProxy`), the only time its location headers are believed. */
  trustLocation: boolean
}

/**
 * Platform-level auth for merchants and staff. Email OTP or a passkey, no passwords.
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
    advanced: {
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
                path: ctx?.path,
                ipAddress: session.ipAddress,
                userAgent: session.userAgent,
                headers: ctx?.headers ?? ctx?.request?.headers,
                trustLocation: opts.trustedProxy === 'cloudflare',
              })
              .catch((err: unknown) => console.error('[sign-in log]', err))
          },
        },
      },
      user: {
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
    ],
  })
}

export type MerchantAuth = ReturnType<typeof createMerchantAuth>
