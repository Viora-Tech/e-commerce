import { describe, expect, it } from 'vitest'
import { loadEnv, loadPlatformEmailEnv, merchantGoogleSignIn } from './env'

const valid = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/commerce',
  DATABASE_URL_OWNER: 'postgres://postgres:postgres@localhost:5432/commerce',
  REDIS_URL: 'redis://localhost:6379',
  WORKER_PORT: '4100',
}

describe('CHECKOUT_SUBDOMAIN', () => {
  it('is undefined when absent or blank', () => {
    expect(loadEnv(valid).CHECKOUT_SUBDOMAIN).toBeUndefined()
    expect(loadEnv({ ...valid, CHECKOUT_SUBDOMAIN: '' }).CHECKOUT_SUBDOMAIN).toBeUndefined()
  })
  it('keeps a valid DNS label', () => {
    expect(loadEnv({ ...valid, CHECKOUT_SUBDOMAIN: 'checkout' }).CHECKOUT_SUBDOMAIN).toBe(
      'checkout',
    )
  })
  it('rejects a value that is not a single DNS label', () => {
    expect(() => loadEnv({ ...valid, CHECKOUT_SUBDOMAIN: 'pay.secure' })).toThrow(
      /CHECKOUT_SUBDOMAIN/,
    )
    expect(() => loadEnv({ ...valid, CHECKOUT_SUBDOMAIN: 'has space' })).toThrow(
      /CHECKOUT_SUBDOMAIN/,
    )
  })
})

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

  it('turns merchant Google sign-in on only with both keys set', () => {
    expect(merchantGoogleSignIn(loadEnv(valid))).toBeNull()
    expect(
      merchantGoogleSignIn(
        loadEnv({ ...valid, MERCHANT_GOOGLE_CLIENT_ID: 'id', MERCHANT_GOOGLE_CLIENT_SECRET: '' }),
      ),
    ).toBeNull()
    expect(
      merchantGoogleSignIn(
        loadEnv({ ...valid, MERCHANT_GOOGLE_CLIENT_ID: 'id', MERCHANT_GOOGLE_CLIENT_SECRET: 's' }),
      ),
    ).toEqual({ clientId: 'id', clientSecret: 's' })
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
      STOREFRONT_CNAME_TARGET: 'shops.koomerce.app',
    })
    expect(env).toMatchObject({ DOMAIN_PROVIDER: 'dns', STOREFRONT_A_RECORD: '15.206.197.145' })
  })

  describe('cloudflare provider', () => {
    const cloudflare = {
      ...valid,
      DOMAIN_PROVIDER: 'cloudflare',
      STOREFRONT_A_RECORD: '15.206.197.145',
      STOREFRONT_CNAME_TARGET: 'shops.koomerce.app',
      CLOUDFLARE_ZONE_ID: '023e105f4ecef8ad9ca31a8372d0c353',
    }

    it('accepts real targets and a zone, without the token the storefront never holds', () => {
      expect(loadEnv(cloudflare)).toMatchObject({ DOMAIN_PROVIDER: 'cloudflare' })
      expect(loadEnv(cloudflare).CLOUDFLARE_API_TOKEN).toBeUndefined()
    })

    it('refuses a documentation address, the default target or no zone', () => {
      const message = /DOMAIN_PROVIDER=cloudflare needs/
      const { STOREFRONT_A_RECORD: _a, ...noAddress } = cloudflare
      const { STOREFRONT_CNAME_TARGET: _c, ...noTarget } = cloudflare
      const { CLOUDFLARE_ZONE_ID: _z, ...noZone } = cloudflare
      expect(() => loadEnv(noAddress)).toThrow(message)
      expect(() => loadEnv(noTarget)).toThrow(message)
      expect(() => loadEnv(noZone)).toThrow(message)
    })

    it('refuses a malformed zone id, without echoing it', () => {
      expect(() => loadEnv({ ...cloudflare, CLOUDFLARE_ZONE_ID: 'not-a-zone' })).toThrow(
        /CLOUDFLARE_ZONE_ID/,
      )
      expect(() => loadEnv({ ...cloudflare, CLOUDFLARE_ZONE_ID: 'not-a-zone' })).not.toThrow(
        /not-a-zone/,
      )
    })

    it('treats blank keys as unset, and leaves the other providers alone', () => {
      expect(() => loadEnv({ ...cloudflare, CLOUDFLARE_ZONE_ID: '' })).toThrow(
        /DOMAIN_PROVIDER=cloudflare needs/,
      )
      expect(loadEnv({ ...valid, CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ZONE_ID: '' })).toMatchObject(
        {
          DOMAIN_PROVIDER: 'dev',
        },
      )
    })
  })

  it('refuses the dns provider without a real server address', () => {
    expect(() => loadEnv({ ...valid, DOMAIN_PROVIDER: 'dns' })).toThrow(/STOREFRONT_A_RECORD/)
    expect(() => loadEnv({ ...valid, DOMAIN_PROVIDER: 'edge' })).toThrow(/DOMAIN_PROVIDER/)
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

describe('platform email env', () => {
  it('treats blanks as unset (compose passes every key, most of them empty)', () => {
    const env = loadPlatformEmailEnv({
      SENDER_EMAIL_PROVIDER: 'resend',
      SENDER_EMAIL_FALLBACK: '',
      RESEND_API_KEY: 're_test',
      SES_REGION: '',
      SES_CONFIGURATION_SET: '',
      PLATFORM_EMAIL_FROM: 'no-reply@mail.platform.test',
    })
    expect(env.SENDER_EMAIL_PROVIDER).toBe('resend')
    expect(env.SENDER_EMAIL_FALLBACK).toBe('none')
    expect(env.SES_REGION).toBeUndefined()
    expect(env.SES_CONFIGURATION_SET).toBeUndefined()
  })

  it('refuses an unknown provider or fallback', () => {
    expect(() => loadPlatformEmailEnv({ SENDER_EMAIL_PROVIDER: 'mailgun' })).toThrow(
      /SENDER_EMAIL_PROVIDER/,
    )
    expect(() => loadPlatformEmailEnv({ SENDER_EMAIL_FALLBACK: 'smtp' })).toThrow(
      /SENDER_EMAIL_FALLBACK/,
    )
  })
})
