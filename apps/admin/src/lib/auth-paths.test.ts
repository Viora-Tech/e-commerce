/** Audit 2026-09-28: Better Auth's organization create endpoint skips the signup gate. */
import { describe, expect, it } from 'vitest'
import { isBlockedAuthPath } from './auth-paths'

describe('isBlockedAuthPath', () => {
  it('refuses organization create however it is spelled', () => {
    for (const p of [
      '/api/auth/organization/create',
      '/api/auth/organization/create/',
      '/api/auth/Organization/Create',
      '/api/auth/organization//create',
      '/api/auth/organization%2Fcreate',
    ]) {
      expect(isBlockedAuthPath(p), p).toBe(true)
    }
  })

  it('refuses the endpoints the admin API wraps', () => {
    for (const p of [
      '/api/auth/email-otp/request-email-change',
      '/api/auth/email-otp/change-email',
      '/api/auth/update-user',
      '/api/auth/list-sessions',
      '/api/auth/List-Sessions/',
    ]) {
      expect(isBlockedAuthPath(p), p).toBe(true)
    }
  })

  it('refuses the account routes Google sign-in does not need', () => {
    for (const p of [
      '/api/auth/link-social',
      '/api/auth/unlink-account',
      '/api/auth/list-accounts',
      '/api/auth/get-access-token',
      '/api/auth/refresh-token',
      '/api/auth/account-info',
      '/api/auth/Link-Social/',
    ]) {
      expect(isBlockedAuthPath(p), p).toBe(true)
    }
  })

  it('lets the rest of Better Auth through', () => {
    for (const p of [
      '/api/auth/email-otp/send-verification-otp',
      '/api/auth/organization/set-active',
      '/api/auth/organization/list',
      '/api/auth/sign-out',
      '/api/auth/passkey/list-user-passkeys',
      '/api/auth/passkey/verify-authentication',
      '/api/auth/revoke-session',
      '/api/auth/sign-in/social',
      '/api/auth/callback/google',
    ]) {
      expect(isBlockedAuthPath(p), p).toBe(false)
    }
  })
})
