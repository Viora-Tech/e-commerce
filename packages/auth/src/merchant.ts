import type { Db } from '@commerce/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, organization } from 'better-auth/plugins'

export type SendOtp = (input: { email: string; otp: string; type: string }) => Promise<void>

export type SendInvite = (input: {
  email: string
  organizationName: string
  inviterEmail: string
  acceptUrl: string
}) => Promise<void>

export type MerchantAuthOptions = {
  db: Db
  baseURL: string
  secret: string
  sendOtp: SendOtp
  /** Staff invitation email. Defaults to a console line so dev needs no mailer. */
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
          await send({
            email: data.email,
            organizationName: data.organization.name,
            inviterEmail: data.inviter.user.email,
            acceptUrl,
          })
        },
      }),
    ],
  })
}

export type MerchantAuth = ReturnType<typeof createMerchantAuth>
