import type { IdentityProvider } from '@commerce/core'

/** Why a provider sign-in came back without a session; `?error=` on the login page. */
export const LOGIN_ERRORS = [
  'unavailable',
  'cancelled',
  'expired',
  'failed',
  'no_email',
  'conflict',
] as const
export type LoginError = (typeof LOGIN_ERRORS)[number]

export const parseLoginError = (raw: unknown): LoginError | null =>
  typeof raw === 'string' && (LOGIN_ERRORS as readonly string[]).includes(raw)
    ? (raw as LoginError)
    : null

/** Confirming the email of a provider sign-in must happen within 15 minutes. */
export const PENDING_LINK_TTL_MS = 15 * 60 * 1000

/** A provider identity whose email the provider did not verify; linked once a code proves it. */
export type PendingLink = {
  p: IdentityProvider
  /** Provider subject. */
  s: string
  /** Email to confirm. */
  m: string
  n: string
  /** Remember this device. */
  r: boolean
  e: number
}
