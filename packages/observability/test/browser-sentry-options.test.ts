import { describe, expect, it } from 'vitest'
import { browserSentryMeta, readBrowserSentryConfig } from '../src/browser-sentry-config'
import {
  browserSentryOptions,
  isBrowserNoise,
  oncePerFingerprint,
  stripQueryStrings,
} from '../src/browser-sentry-options'
import { queueEarlyBrowserErrors } from '../src/early-browser-errors'

const ORIGIN = 'https://shop.example.in'
const DSN = 'https://abc123@errors.vioratech.in/2'

const errorAt = (value: string, filename = `${ORIGIN}/_next/static/chunks/app.js`, lineno = 1) => ({
  exception: {
    values: [{ type: 'Error', value, stacktrace: { frames: [{ filename, lineno, colno: 5 }] } }],
  },
})

describe('browserSentryMeta / readBrowserSentryConfig', () => {
  it('renders nothing without a DSN', () => {
    expect(browserSentryMeta({})).toBeUndefined()
  })

  it('carries only the DSN, environment and release, and reads back', () => {
    const meta = browserSentryMeta({
      SENTRY_DSN: DSN,
      SENTRY_ENVIRONMENT: 'production',
      SENTRY_RELEASE: 'abc',
    })
    expect(meta?.name).toBe('sentry-browser')
    expect(Object.keys(JSON.parse(meta?.content ?? '{}')).sort()).toEqual([
      'dsn',
      'environment',
      'release',
    ])
    expect(readBrowserSentryConfig(meta?.content)).toEqual({
      dsn: DSN,
      environment: 'production',
      release: 'abc',
    })
  })

  it('rejects a missing or malformed tag', () => {
    expect(readBrowserSentryConfig(null)).toBeUndefined()
    expect(readBrowserSentryConfig('not json')).toBeUndefined()
    expect(
      readBrowserSentryConfig('{"dsn":"javascript:alert(1)","environment":"x"}'),
    ).toBeUndefined()
  })
})

describe('isBrowserNoise', () => {
  it('drops ResizeObserver, aborted and failed fetches, and hidden cross-origin errors', () => {
    expect(isBrowserNoise(errorAt('ResizeObserver loop limit exceeded'), ORIGIN)).toBe(true)
    expect(
      isBrowserNoise(
        { exception: { values: [{ type: 'TypeError', value: 'Load failed' }] } },
        ORIGIN,
      ),
    ).toBe(true)
    expect(
      isBrowserNoise(
        { exception: { values: [{ type: 'AbortError', value: 'The user aborted a request.' }] } },
        ORIGIN,
      ),
    ).toBe(true)
    expect(isBrowserNoise({ message: 'Script error.' }, ORIGIN)).toBe(true)
  })

  it('drops errors from extensions and third-party scripts', () => {
    expect(isBrowserNoise(errorAt('x', 'chrome-extension://abcd/content.js'), ORIGIN)).toBe(true)
    expect(isBrowserNoise(errorAt('x', 'moz-extension://abcd/content.js'), ORIGIN)).toBe(true)
    expect(isBrowserNoise(errorAt('x', 'https://connect.facebook.net/fbevents.js'), ORIGIN)).toBe(
      true,
    )
  })

  it('keeps our own errors, and messages with no stack', () => {
    expect(isBrowserNoise(errorAt('Cannot read properties of undefined'), ORIGIN)).toBe(false)
    expect(isBrowserNoise({ message: 'checkout total mismatch' }, ORIGIN)).toBe(false)
  })
})

describe('oncePerFingerprint', () => {
  it('lets each bug through once per page load', () => {
    const firstTime = oncePerFingerprint()
    expect(firstTime(errorAt('boom'))).toBe(true)
    expect(firstTime(errorAt('boom'))).toBe(false)
    expect(firstTime(errorAt('boom', undefined, 2))).toBe(true)
  })

  it('caps the total per page load', () => {
    const firstTime = oncePerFingerprint()
    const sent = Array.from({ length: 50 }, (_, i) => firstTime(errorAt(`bug ${i}`))).filter(
      Boolean,
    )
    expect(sent).toHaveLength(30)
  })
})

describe('stripQueryStrings', () => {
  it('drops query and hash from URLs, wherever they are', () => {
    const out = stripQueryStrings({
      request: {
        url: `${ORIGIN}/orders/status?token=abc&email=a@b.co#x`,
        query_string: 'token=abc',
        headers: { Referer: `${ORIGIN}/cart?coupon=SAVE` },
      },
      breadcrumbs: [{ data: { url: '/api/orders?email=a@b.co', from: '/a?x=1', to: '/b#y' } }],
      exception: { values: [{ value: `failed loading ${ORIGIN}/p?order=123 now` }] },
    })
    expect(out.request.url).toBe(`${ORIGIN}/orders/status`)
    expect(out.request).not.toHaveProperty('query_string')
    expect(out.request.headers.Referer).toBe(`${ORIGIN}/cart`)
    expect(out.breadcrumbs[0]?.data).toEqual({ url: '/api/orders', from: '/a', to: '/b' })
    expect(out.exception.values[0]?.value).toBe(`failed loading ${ORIGIN}/p now`)
  })
})

describe('browserSentryOptions', () => {
  const options = () =>
    browserSentryOptions({ dsn: DSN, environment: 'production', release: undefined }, ORIGIN)

  it('is errors only, without default PII', () => {
    const o = options()
    expect(o.tracesSampleRate).toBe(0)
    expect(o.sendDefaultPii).toBe(false)
  })

  it('beforeSend filters noise, sends a bug once, strips queries and scrubs PII', () => {
    const { beforeSend } = options()
    expect(beforeSend(errorAt('ResizeObserver loop limit exceeded'))).toBeNull()
    const event = {
      ...errorAt('payment failed for asha@example.com'),
      request: { url: `${ORIGIN}/checkout?step=2` },
    }
    const sent = beforeSend(event)
    expect(sent?.request.url).toBe(`${ORIGIN}/checkout`)
    expect(JSON.stringify(sent)).not.toContain('asha@example.com')
    expect(beforeSend(event)).toBeNull()
  })
})

describe('queueEarlyBrowserErrors', () => {
  it('holds errors until flushed, then stops listening', () => {
    const listeners = new Map<
      string,
      (e: { type: string; error?: unknown; reason?: unknown }) => void
    >()
    const target = {
      addEventListener: (type: string, fn: (e: { type: string }) => void) =>
        listeners.set(type, fn),
      removeEventListener: (type: string) => listeners.delete(type),
    }
    const early = queueEarlyBrowserErrors(target)
    const boom = new Error('boom')
    listeners.get('error')?.({ type: 'error', error: boom })
    listeners.get('unhandledrejection')?.({ type: 'unhandledrejection', reason: 'nope' })
    const captured: unknown[] = []
    early.flush((e) => captured.push(e))
    expect(captured).toEqual([boom, 'nope'])
    expect(listeners.size).toBe(0)
  })
})
