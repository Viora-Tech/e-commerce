import { createMerchantAuth, type MerchantAuth } from '@commerce/auth'
import { loadEnv } from '@commerce/config'
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
      // Dev delivery: print the code, and hand it to the readback route so the
      // login page can show it when DEV_LOGIN_OTP is on. Production sends mail
      // through the notification channels instead.
      sendOtp: async ({ email, otp, type }) => {
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
