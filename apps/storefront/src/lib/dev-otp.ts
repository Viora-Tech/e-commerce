/**
 * Development-only readback for storefront sign-in codes, mirroring the admin's.
 *
 * Nothing sends mail in development unless an email channel is configured, so the
 * code is printed and remembered here; `/api/dev/otp?email=` hands it back. Two
 * keys guard it: off in production builds and off unless `DEV_LOGIN_OTP=1`.
 */
const g = globalThis as unknown as { __storefrontDevOtp?: Map<string, string> }

export function devOtpEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.DEV_LOGIN_OTP === '1'
}

const key = (storeId: string, email: string) => `${storeId}:${email.trim().toLowerCase()}`

export function rememberDevOtp(storeId: string, email: string, otp: string): void {
  if (!devOtpEnabled()) return
  g.__storefrontDevOtp ??= new Map()
  g.__storefrontDevOtp.set(key(storeId, email), otp)
}

export function recallDevOtp(storeId: string, email: string): string | null {
  if (!devOtpEnabled()) return null
  return g.__storefrontDevOtp?.get(key(storeId, email)) ?? null
}
