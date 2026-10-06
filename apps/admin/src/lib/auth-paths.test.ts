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

  it('lets the rest of Better Auth through', () => {
    for (const p of [
      '/api/auth/email-otp/send-verification-otp',
      '/api/auth/organization/set-active',
      '/api/auth/organization/list',
      '/api/auth/sign-out',
    ]) {
      expect(isBlockedAuthPath(p), p).toBe(false)
    }
  })
})
