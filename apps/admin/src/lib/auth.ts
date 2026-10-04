import 'server-only'
import { createMerchantAuth, type MerchantAuth } from '@commerce/auth'
import { loadEnv } from '@commerce/config'
import { deliverPlatformLoginCode, getPlatformEmail } from '@commerce/core'
import { headers } from 'next/headers'
import { db } from './db'
import { rememberDevOtp } from './dev-otp'

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
      // With the platform email account configured (SENDER_EMAIL_PROVIDER=ses) the code is
      // emailed and never logged: a logged code lets anyone with log access sign in. Without
      // it (development) the code is printed and handed to the readback route so the login
      // page can show it when DEV_LOGIN_OTP is on.
      sendOtp: async ({ email, otp, type }) => {
        if (getPlatformEmail().transport) {
          const sent = await deliverPlatformLoginCode({ email, code: otp })
          if (!sent) throw new Error('Could not send the sign-in code. Try again in a minute.')
          return
        }
        console.log(`[otp] ${type} code for ${email}: ${otp}`)
        rememberDevOtp(email, otp)
      },
    })
  }
  return g.__merchantAuth
}

export async function getSession() {
  return auth().api.getSession({ headers: await headers() })
}
