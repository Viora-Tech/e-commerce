import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CourierError } from '../src/courier-error'
import { LoginTokenCache } from '../src/login-token'
import { firstHeader, hmacSha256Matches } from '../src/webhook-auth'

const body = '{"awb_number":"X1","status":"delivered"}'
const mac = createHmac('sha256', 'shh-secret').update(body).digest()

describe('hmacSha256Matches', () => {
  it('accepts hex, prefixed hex and base64 signatures made with the secret', () => {
    expect(hmacSha256Matches(body, 'shh-secret', mac.toString('hex'))).toBe(true)
    expect(hmacSha256Matches(body, 'shh-secret', `sha256=${mac.toString('hex')}`)).toBe(true)
    expect(hmacSha256Matches(body, 'shh-secret', mac.toString('base64'))).toBe(true)
  })

  it('rejects another secret, a changed body and an empty signature', () => {
    expect(hmacSha256Matches(body, 'other', mac.toString('hex'))).toBe(false)
    expect(hmacSha256Matches(`${body} `, 'shh-secret', mac.toString('base64'))).toBe(false)
    expect(hmacSha256Matches(body, 'shh-secret', '')).toBe(false)
  })
})

describe('firstHeader', () => {
  it('returns the first present header, trimmed', () => {
    expect(firstHeader({ b: ' two ', c: 'three' }, ['a', 'b', 'c'])).toBe('two')
    expect(firstHeader({}, ['a'])).toBe('')
  })
})

describe('LoginTokenCache', () => {
  it('logs in once for concurrent callers and reuses the token', async () => {
    let logins = 0
    const cache = new LoginTokenCache(async () => {
      logins++
      return { token: `t${logins}`, lifetimeMs: 60 * 60 * 1000 }
    })
    const [a, b] = await Promise.all([cache.get(), cache.get()])
    expect([a, b, await cache.get()]).toEqual(['t1', 't1', 't1'])
    expect(logins).toBe(1)
  })

  it('logs in again when the token is inside the refresh margin', async () => {
    let logins = 0
    const cache = new LoginTokenCache(async () => {
      logins++
      return { token: `t${logins}`, lifetimeMs: 1000 }
    }, 5000)
    await cache.get()
    expect(await cache.get()).toBe('t2')
  })

  it('retries a call once with a fresh token after an auth failure', async () => {
    let logins = 0
    const cache = new LoginTokenCache(async () => {
      logins++
      return { token: `t${logins}`, lifetimeMs: 60 * 60 * 1000 }
    })
    const seen: string[] = []
    const result = await cache.withToken(async (token) => {
      seen.push(token)
      if (token === 't1') throw new CourierError('auth', 'x', 'expired')
      return 'ok'
    })
    expect(result).toBe('ok')
    expect(seen).toEqual(['t1', 't2'])
  })
})
