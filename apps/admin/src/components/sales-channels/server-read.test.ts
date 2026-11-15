/** SOURCE OF TRUTH: Sales channels and Inbox server reads — WHAT: a failed read says why (no access, Inbox not installed, anything else) / WHY: every failure used to read as "you need access" or "install the Inbox app" (design audit page pass 13, 14 Nov 2026) */
import { describe, expect, it } from 'vitest'
import { FORBIDDEN_DIGEST } from '@/lib/forbidden'
import { failed, read, readFailure } from './server-read'

describe('readFailure', () => {
  it('names a role that may not read it as no-access', () => {
    expect(readFailure({ code: 'FORBIDDEN' })).toBe('no-access')
    expect(readFailure(Object.assign(new Error('x'), { digest: FORBIDDEN_DIGEST }))).toBe(
      'no-access',
    )
  })

  it('names the Inbox app missing as not-installed', () => {
    expect(readFailure({ code: 'PRECONDITION_FAILED' })).toBe('not-installed')
  })

  it('names anything else (a timeout, a crash) as a plain error', () => {
    expect(readFailure(new Error('connection reset'))).toBe('error')
    expect(readFailure({ code: 'INTERNAL_SERVER_ERROR' })).toBe('error')
    expect(readFailure(null)).toBe('error')
  })
})

describe('read', () => {
  it('passes the answer through', async () => {
    const value = await read(Promise.resolve({ ok: true }))
    expect(failed(value)).toBe(false)
    expect(value).toEqual({ ok: true })
  })

  it('turns a rejection into its reason', async () => {
    const value = await read(Promise.reject(new Error('boom')))
    expect(failed(value)).toBe(true)
    expect(value).toBe('error')
  })
})
