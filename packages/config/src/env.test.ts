import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/commerce',
  DATABASE_URL_OWNER: 'postgres://postgres:postgres@localhost:5432/commerce',
  REDIS_URL: 'redis://localhost:6379',
  WORKER_PORT: '4100',
}

describe('loadEnv', () => {
  it('parses a valid environment and coerces the port', () => {
    const env = loadEnv(valid)
    expect(env.WORKER_PORT).toBe(4100)
    expect(env.REDIS_URL).toBe('redis://localhost:6379')
  })

  it('fails fast naming the missing key', () => {
    const { DATABASE_URL: _drop, ...rest } = valid
    expect(() => loadEnv(rest)).toThrow(/Invalid environment:.*DATABASE_URL/)
  })

  it('treats a blank optional value as unset (Dokploy, compose KEY:- defaults)', () => {
    const env = loadEnv({ ...valid, SENTRY_DSN: '', SES_REGION: '  ', PLATFORM_EMAIL_FROM: '' })
    expect(env.SENTRY_DSN).toBeUndefined()
    expect(env.SES_REGION).toBeUndefined()
    expect(env.PLATFORM_EMAIL_FROM).toBeUndefined()
  })

  it('still fails a blank required value, as missing', () => {
    expect(() => loadEnv({ ...valid, DATABASE_URL: '' })).toThrow(
      /Invalid environment:.*DATABASE_URL/,
    )
  })

  it('still rejects a non-blank invalid value', () => {
    expect(() => loadEnv({ ...valid, SENTRY_DSN: 'not-a-url' })).toThrow(/SENTRY_DSN/)
  })

  it('defaults custom domain checks to the offline dev provider', () => {
    expect(loadEnv(valid).DOMAIN_PROVIDER).toBe('dev')
  })

  it('accepts the real dns provider with the server address', () => {
    const env = loadEnv({
      ...valid,
      DOMAIN_PROVIDER: 'dns',
      STOREFRONT_A_RECORD: '15.206.197.145',
      STOREFRONT_CNAME_TARGET: 'shops.vioratech.in',
    })
    expect(env).toMatchObject({ DOMAIN_PROVIDER: 'dns', STOREFRONT_A_RECORD: '15.206.197.145' })
  })

  it('refuses the dns provider without a real server address', () => {
    expect(() => loadEnv({ ...valid, DOMAIN_PROVIDER: 'dns' })).toThrow(/STOREFRONT_A_RECORD/)
    expect(() => loadEnv({ ...valid, DOMAIN_PROVIDER: 'cloudflare' })).toThrow(/DOMAIN_PROVIDER/)
  })
})
