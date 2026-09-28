/** SOURCE OF TRUTH: shopper social sign-in providers — WHAT: Google, Apple and Facebook OAuth (authorisation URL with PKCE, code exchange, profile to a shopper identity) and Google One Tap credential checks, built on Better Auth's official provider modules / WHY: provider protocols (PKCE, Apple's signed client secret, ID token checks) are easy to get subtly wrong, so we reuse the maintained implementation instead of writing our own */
import { apple, facebook, google, verifyGoogleIdToken } from 'better-auth/social-providers'
import { importPKCS8, SignJWT } from 'jose'
import type { SocialProvider } from '../customer-accounts/client'
import type { AppleApp, FacebookApp, GoogleApp } from './credentials'
import type { ShopperIdentity } from './identities'

/*
 * Better Auth 1.7.6 (MIT), `better-auth/social-providers`:
 * https://www.better-auth.com/docs/authentication/google
 * https://www.better-auth.com/docs/authentication/apple
 * https://www.better-auth.com/docs/authentication/facebook
 * https://www.better-auth.com/docs/plugins/one-tap (we call the same `verifyGoogleIdToken`)
 * The docs host was blocked from the build machine; this was written against the package
 * source in node_modules (`@better-auth/core/dist/social-providers/*.mjs`).
 *
 * We use the provider modules, not `betterAuth()` itself: shoppers are per-store
 * customers under RLS with their own sessions (`accounts/auth.ts`), while Better Auth's
 * user/session tables are global and hold merchant staff.
 */

export type SocialApp = GoogleApp | AppleApp | FacebookApp

/** Apple's client secret is a JWT we sign with the .p8 key (ES256), valid up to 6 months. */
export async function appleClientSecret(app: AppleApp, now: Date = new Date()): Promise<string> {
  const key = await importPKCS8(app.privateKey, 'ES256')
  const iat = Math.floor(now.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: app.keyId })
    .setIssuer(app.teamId)
    .setSubject(app.servicesId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(iat)
    .setExpirationTime(iat + 60 * 60)
    .sign(key)
}

async function providerFor(app: SocialApp, redirectURI: string) {
  switch (app.provider) {
    case 'google':
      return google({ clientId: app.clientId, clientSecret: app.clientSecret, redirectURI })
    case 'apple':
      return apple({
        clientId: app.servicesId,
        clientSecret: await appleClientSecret(app),
        redirectURI,
      })
    case 'facebook':
      return facebook({ clientId: app.appId, clientSecret: app.appSecret, redirectURI })
  }
}

/** The provider's consent page URL. `state` and the PKCE verifier are the caller's to keep. */
export async function authorizationUrl(
  app: SocialApp,
  input: { redirectURI: string; state: string; codeVerifier: string },
): Promise<string> {
  const provider = await providerFor(app, input.redirectURI)
  const url = await provider.createAuthorizationURL({
    state: input.state,
    codeVerifier: input.codeVerifier,
    redirectURI: input.redirectURI,
  })
  return url.toString()
}

type ProfileInfo = {
  user: { email?: string | null | undefined; emailVerified: boolean; name?: string | undefined }
  data: Record<string, unknown>
}

/** Map Better Auth's user info to our identity. The subject is the provider's id, never the email. */
export function identityFromUserInfo(
  provider: SocialProvider,
  info: ProfileInfo | null,
): ShopperIdentity | null {
  if (!info) return null
  const raw = info.data.sub ?? info.data.id
  const subject = typeof raw === 'string' || typeof raw === 'number' ? String(raw) : ''
  if (!subject) return null
  const email = typeof info.user.email === 'string' && info.user.email ? info.user.email : null
  return {
    provider,
    subject,
    email,
    emailVerified: Boolean(email) && info.user.emailVerified === true,
    name: info.user.name?.trim() || null,
  }
}

/**
 * Exchange the code and read the profile. `appleUser` is the JSON Apple posts on the
 * first sign-in only (it carries the name).
 */
export async function finishSignIn(
  app: SocialApp,
  input: { code: string; codeVerifier: string; redirectURI: string; appleUser?: unknown },
): Promise<ShopperIdentity | null> {
  const provider = await providerFor(app, input.redirectURI)
  const tokens = await provider.validateAuthorizationCode({
    code: input.code,
    codeVerifier: input.codeVerifier,
    redirectURI: input.redirectURI,
  })
  const user =
    app.provider === 'apple' && input.appleUser && typeof input.appleUser === 'object'
      ? (input.appleUser as { name?: { firstName?: string; lastName?: string } })
      : undefined
  const info = (await provider.getUserInfo({ ...tokens, user })) as ProfileInfo | null
  return identityFromUserInfo(app.provider, info)
}

/**
 * Check a Google One Tap credential (an ID token) for this store's Google app, and the
 * nonce the page generated for it.
 */
export async function verifyOneTapCredential(
  app: GoogleApp,
  credential: unknown,
  nonce: string,
): Promise<ShopperIdentity | null> {
  if (typeof credential !== 'string' || credential.length > 4096) return null
  const payload = await verifyGoogleIdToken({ token: credential, audience: app.clientId, nonce })
  if (!payload || typeof payload.sub !== 'string') return null
  const email = typeof payload.email === 'string' ? payload.email : null
  const verified = payload.email_verified === true || payload.email_verified === 'true'
  return {
    provider: 'google',
    subject: payload.sub,
    email,
    emailVerified: Boolean(email) && verified,
    name: typeof payload.name === 'string' ? payload.name : null,
  }
}
