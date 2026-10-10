import { AsyncLocalStorage } from 'node:async_hooks'
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
}

/**
 * Platform-level auth for merchants and staff. Email OTP only, no passwords.
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
