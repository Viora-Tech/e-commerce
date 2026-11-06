import type { Env } from './env'

/**
 * The app-store reviewer's password sign-in, or null when either key is unset: the admin then
 * leaves the endpoint out of Better Auth and hides "Sign in with a password".
 */
export function reviewerSignIn(
  env: Pick<Env, 'REVIEWER_LOGIN_EMAIL' | 'REVIEWER_LOGIN_PASSWORD'>,
): { email: string; password: string } | null {
  const email = env.REVIEWER_LOGIN_EMAIL
  const password = env.REVIEWER_LOGIN_PASSWORD
  return email && password ? { email: email.toLowerCase(), password } : null
}

/**
 * The merchant Google sign-in client, or null when either key is unset: the admin then leaves
 * the provider out of Better Auth and hides "Continue with Google".
 */
export function merchantGoogleSignIn(
  env: Pick<Env, 'MERCHANT_GOOGLE_CLIENT_ID' | 'MERCHANT_GOOGLE_CLIENT_SECRET'>,
): { clientId: string; clientSecret: string } | null {
  const clientId = env.MERCHANT_GOOGLE_CLIENT_ID
  const clientSecret = env.MERCHANT_GOOGLE_CLIENT_SECRET
  return clientId && clientSecret ? { clientId, clientSecret } : null
}
