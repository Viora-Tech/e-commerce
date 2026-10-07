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

  it('leaves the Dokploy route keys unset when blank and defaults the storefront port', () => {
    const env = loadEnv({
      ...valid,
      DOKPLOY_URL: '',
      DOKPLOY_API_KEY: '',
      DOKPLOY_STOREFRONT_APPLICATION_ID: '',
      DOKPLOY_STOREFRONT_PORT: '',
    })
    expect(env.DOKPLOY_URL).toBeUndefined()
    expect(env.DOKPLOY_API_KEY).toBeUndefined()
    expect(env.DOKPLOY_STOREFRONT_APPLICATION_ID).toBeUndefined()
    expect(env.DOKPLOY_STOREFRONT_PORT).toBe(3100)
    const set = loadEnv({
      ...valid,
      DOKPLOY_URL: 'https://dokploy.example.com',
      DOKPLOY_STOREFRONT_PORT: '3000',
    })
    expect(set.DOKPLOY_URL).toBe('https://dokploy.example.com')
    expect(set.DOKPLOY_STOREFRONT_PORT).toBe(3000)
    expect(() => loadEnv({ ...valid, DOKPLOY_URL: 'ftp://dokploy' })).toThrow(/DOKPLOY_URL/)
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

describe('bug reports env', () => {
  it('is off by default and files in the platform repo', () => {
    const env = loadEnv(valid)
    expect(env.BUG_REPORTS_ENABLED).toBe(false)
    expect(env.GITHUB_ISSUES_TOKEN).toBeUndefined()
    expect(env.GITHUB_ISSUES_REPO).toBe('Viora-Tech/e-commerce')
  })

  it('reads true/false spellings and treats blank as off', () => {
    expect(loadEnv({ ...valid, BUG_REPORTS_ENABLED: 'true' }).BUG_REPORTS_ENABLED).toBe(true)
    expect(loadEnv({ ...valid, BUG_REPORTS_ENABLED: 'TRUE' }).BUG_REPORTS_ENABLED).toBe(true)
    expect(loadEnv({ ...valid, BUG_REPORTS_ENABLED: '1' }).BUG_REPORTS_ENABLED).toBe(true)
    expect(loadEnv({ ...valid, BUG_REPORTS_ENABLED: 'false' }).BUG_REPORTS_ENABLED).toBe(false)
    expect(loadEnv({ ...valid, BUG_REPORTS_ENABLED: '' }).BUG_REPORTS_ENABLED).toBe(false)
    expect(() => loadEnv({ ...valid, BUG_REPORTS_ENABLED: 'maybe' })).toThrow(/BUG_REPORTS_ENABLED/)
  })

  it('allows on without a token in development (the report is logged instead)', () => {
    const env = loadEnv({ ...valid, BUG_REPORTS_ENABLED: 'true', NODE_ENV: 'development' })
    expect(env.BUG_REPORTS_ENABLED).toBe(true)
  })

  it('refuses on without a token in production, saying what to set', () => {
    expect(() =>
      loadEnv({
        ...valid,
        BUG_REPORTS_ENABLED: 'true',
        NODE_ENV: 'production',
        GITHUB_ISSUES_TOKEN: '',
      }),
    ).toThrow(/GITHUB_ISSUES_TOKEN \(BUG_REPORTS_ENABLED=true in production needs/)
    const env = loadEnv({
      ...valid,
      BUG_REPORTS_ENABLED: 'true',
      NODE_ENV: 'production',
      SETTINGS_SECRET: 'a-real-production-secret',
      GITHUB_ISSUES_TOKEN: 'github_pat_x',
    })
    expect(env.GITHUB_ISSUES_TOKEN).toBe('github_pat_x')
  })

  // Security audit 2026-10-06 (A-02): blank-means-unset (#245) turned a blank SETTINGS_SECRET
  // into the public development default; production must refuse to start instead.
  it('refuses a missing or blank SETTINGS_SECRET in production, never the public default', () => {
    for (const SETTINGS_SECRET of [undefined, '', '   ', 'dev-only-settings-secret']) {
      expect(() => loadEnv({ ...valid, NODE_ENV: 'production', SETTINGS_SECRET })).toThrow(
        /SETTINGS_SECRET/,
      )
    }
    const env = loadEnv({ ...valid, NODE_ENV: 'production', SETTINGS_SECRET: 'x'.repeat(32) })
    expect(env.SETTINGS_SECRET).toBe('x'.repeat(32))
    expect(loadEnv(valid).SETTINGS_SECRET).toBe('dev-only-settings-secret')
  })

  it('rejects a repo that is not owner/name', () => {
    expect(() => loadEnv({ ...valid, GITHUB_ISSUES_REPO: 'https://github.com/a/b' })).toThrow(
      /GITHUB_ISSUES_REPO/,
    )
  })
})
