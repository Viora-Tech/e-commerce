import 'server-only'
import { createMerchantAuth, type MerchantAuth } from '@commerce/auth'
import { loadEnv, merchantGoogleSignIn } from '@commerce/config'
import {
  deliverPlatformEmailChangeCode,
  deliverPlatformLoginCode,
  deliverPlatformStaffInvite,
  getPlatformEmail,
  recordMemberSignIn,
} from '@commerce/core'
import { headers } from 'next/headers'
import { cache } from 'react'
import { db } from './db'
import { mayPrintCodes, rememberDevOtp } from './dev-otp'

const g = globalThis as unknown as { __merchantAuth?: MerchantAuth }

export function auth(): MerchantAuth {
  if (!g.__merchantAuth) {
    const env = loadEnv(process.env)
    if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET is required for the admin app')
    g.__merchantAuth = createMerchantAuth({
      db: db(),
      baseURL: env.ADMIN_URL,
      secret: env.AUTH_SECRET,
      trustedOrigins: [env.ADMIN_URL],
      trustedProxy: env.TRUSTED_PROXY,
      onSignIn: (event) => recordMemberSignIn(db(), event),
      // "Continue with Google" on the login page; off unless both MERCHANT_GOOGLE_* keys are set.
      google: merchantGoogleSignIn(env),
      // With the platform email account configured (SENDER_EMAIL_PROVIDER=ses) the code is
      // emailed and never logged: a logged code lets anyone with log access sign in. Without
      // it (development) the code is printed and handed to the readback route so the login
      // page can show it when DEV_LOGIN_OTP is on.
      // `change-email` is the code to a member's NEW address (Account → Sign-in & security);
      // every other type is a sign-in code.
      sendOtp: async ({ email, otp, type }) => {
        if (getPlatformEmail().transport) {
          const sent =
            type === 'change-email'
              ? await deliverPlatformEmailChangeCode({ email, code: otp })
              : await deliverPlatformLoginCode({ email, code: otp })
          if (!sent) throw new Error('Could not send the code. Try again in a minute.')
          return
        }
        if (!mayPrintCodes()) {
          console.error(
            '[otp] no platform email account (SENDER_EMAIL_PROVIDER=ses); code not sent',
          )
          throw new Error('Could not send the sign-in code. Try again in a minute.')
        }
        console.log(`[otp] ${type} code for ${email}: ${otp}`)
        rememberDevOtp(email, otp)
      },
      // Same rule for staff invitations: emailed through the platform account and never logged
      // (the accept link lets the invited email join the store). A refused send throws, and the
      // Staff page says the email did not go; the invite stays listed with "Resend email".
      // Without the platform account (development) the link is printed instead.
      sendInvite: async (invite) => {
        const result = await deliverPlatformStaffInvite({
          email: invite.email,
          storeName: invite.storeName ?? invite.organizationName,
          inviterEmail: invite.inviterEmail,
          roleLabel: invite.roleLabel,
          acceptUrl: invite.acceptUrl,
        })
        if (result === 'sent') return
        if (result === 'refused' || !mayPrintCodes()) {
          throw new Error("Couldn't send the invite email")
        }
        console.log(`[invite] ${invite.email} for ${invite.organizationName}: ${invite.acceptUrl}`)
      },
    })
  }
  return g.__merchantAuth
}

/** The signed-in session, read once per server render (the layout and the page both ask). */
export const getSession = cache(async () => auth().api.getSession({ headers: await headers() }))
