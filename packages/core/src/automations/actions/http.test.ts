/** SOURCE OF TRUTH: HTTP action tests — WHAT: signing, secret filling and redaction, retry classes, rate cap and the SSRF guard (private, loopback, link-local, metadata, IPv6, redirects) with injected fetch and DNS / WHY: no external calls in tests, and data must never reach our own network. */
import { createHmac } from 'node:crypto'
import type { StoreTx } from '@commerce/db'
import { describe, expect, it, vi } from 'vitest'
import { createMemoryRateLimitStore } from '../../rate-limit/memory-store'
import { encryptSecret } from '../../secrets'
import { type ActionContext, type ActionExecutor, AutomationActionError } from '../executor'
import { httpExecutors, httpSigningKey, signRequest } from './http'
import type { BuiltinActionDeps } from './shared'

const SECRET = 'test-settings-secret'
const STORE = '00000000-0000-4000-8000-000000000001'

/** Just enough of a transaction for the secret lookup: `select().from().where()` → rows. */
function fakeTx(secrets: Record<string, string> = {}): StoreTx {
  const rows = Object.entries(secrets).map(([handle, v]) => ({
    handle,
    value: encryptSecret(v, SECRET),
  }))
  const chain = { from: () => chain, where: () => Promise.resolve(rows) }
  return { select: () => chain } as unknown as StoreTx
}

function ctx(over: Partial<ActionContext> = {}): ActionContext {
  return {
    storeId: STORE,
    workflow: { id: 'wf-1', name: 'Hook', versionId: 'v1' },
    runId: 'run-1',
    nodeId: 'n1',
    iteration: 0,
    stepKey: 'run-1:n1:0',
    attempt: 1,
    subject: { type: 'order', id: 'o1' },
    data: { order: { number: '1042' } },
    triggerData: {},
    cause: null,
    dryRun: false,
    render: (t) => t.replace('{order.number}', '1042'),
    log: () => {},
    ...over,
  }
}

const publicLookup = async () => ['93.184.216.34']

function setup(
  respond: (url: string, init: RequestInit) => Response | Promise<Response> = () =>
    new Response('ok', { status: 200 }),
  extra: Partial<BuiltinActionDeps> = {},
) {
  const fetch = vi.fn(async (url: string, init: RequestInit) => respond(url, init))
  const deps: BuiltinActionDeps = {
    registry: {} as BuiltinActionDeps['registry'],
    settingsSecret: SECRET,
    storefrontUrl: 'https://shop.example',
    fetch: fetch as unknown as typeof globalThis.fetch,
    lookup: publicLookup,
    ...extra,
  }
  const executor = httpExecutors(async () => deps)[0] as unknown as ActionExecutor<never>
  return { executor, fetch, deps }
}

const config = (over: Record<string, unknown> = {}) =>
  ({
    method: 'POST',
    url: 'https://hooks.example.com/order/{order.number}',
    headers: [],
    body: '{"order":"{order.number}"}',
    onHttpError: 'retry',
    ...over,
  }) as never

describe('http.request', () => {
  it('posts the rendered body, signed, with the step key as idempotency key', async () => {
    const { executor, fetch } = setup()
    const r = await executor.run({ tx: fakeTx(), ctx: ctx(), config: config() })
    expect(r.output).toMatchObject({ status: 200, body: 'ok', method: 'POST' })
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/order/1042')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"order":"1042"}')
    const h = init.headers as Record<string, string>
    expect(h['Idempotency-Key']).toBe('run-1:n1:0')
    expect(h['Content-Type']).toBe('application/json')
    const ts = Number(h['X-Webhook-Timestamp'])
    const key = httpSigningKey(STORE, SECRET)
    expect(h['X-Webhook-Signature']).toBe(
      `sha256=${createHmac('sha256', key).update(`${ts}.{"order":"1042"}`).digest('hex')}`,
    )
    expect(signRequest(key, ts, '{"order":"1042"}')).toBe(h['X-Webhook-Signature'])
  })

  it('fills secrets but never shows them in the output or preview', async () => {
    const { executor, fetch } = setup(() => new Response('echo s3cr3t-token', { status: 200 }))
    const tx = fakeTx({ api_key: 's3cr3t-token' })
    const cfg = config({
      url: 'https://hooks.example.com/x?key={{secrets.api_key}}',
      headers: [{ name: 'Authorization', value: 'Bearer {{ secrets.api_key }}' }],
    })
    const r = await executor.run({ tx, ctx: ctx(), config: cfg })
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://hooks.example.com/x?key=s3cr3t-token')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s3cr3t-token')
    expect(JSON.stringify(r)).not.toContain('s3cr3t-token')
    expect(r.output).toMatchObject({ url: 'https://hooks.example.com/x?key=•••', body: 'echo •••' })
    const p = await executor.preview({ tx, ctx: ctx({ dryRun: true }), config: cfg })
    expect(JSON.stringify(p)).not.toContain('s3cr3t-token')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('signs with the store signing_key secret when there is one', async () => {
    const { executor, fetch } = setup()
    await executor.run({
      tx: fakeTx({ signing_key: 'merchant-key' }),
      ctx: ctx(),
      config: config(),
    })
    const h = (fetch.mock.calls[0] as [string, RequestInit])[1].headers as Record<string, string>
    expect(h['X-Webhook-Signature']).toBe(
      signRequest('merchant-key', Number(h['X-Webhook-Timestamp']), '{"order":"1042"}'),
    )
  })

  it('fails without retry on an unknown secret, a reserved header or a non-https address', async () => {
    const { executor, fetch } = setup()
    const fail = (cfg: never) => executor.run({ tx: fakeTx(), ctx: ctx(), config: cfg })
    await expect(fail(config({ body: '{{secrets.nope}}' }))).rejects.toMatchObject({
      retryable: false,
    })
    await expect(
      fail(config({ headers: [{ name: 'Host', value: 'internal' }] })),
    ).rejects.toMatchObject({ retryable: false })
    await expect(fail(config({ url: 'http://hooks.example.com/' }))).rejects.toMatchObject({
      retryable: false,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('retries 429/5xx (with Retry-After), fails other 4xx, and carries on when asked', async () => {
    const status = (code: number, headers: Record<string, string> = {}) =>
      setup(() => new Response('no', { status: code, headers })).executor
    const run = (code: number, onHttpError: string, headers?: Record<string, string>) =>
      status(code, headers).run({ tx: fakeTx(), ctx: ctx(), config: config({ onHttpError }) })

    await expect(run(503, 'retry')).rejects.toMatchObject({ retryable: true })
    const limited = await run(429, 'retry', { 'retry-after': '7' }).catch((e) => e)
    expect(limited).toBeInstanceOf(AutomationActionError)
    expect(limited).toMatchObject({ retryable: true, retryAfterMs: 7000 })
    await expect(run(400, 'retry')).rejects.toMatchObject({ retryable: false })
    await expect(run(503, 'fail')).rejects.toMatchObject({ retryable: false })
    const carried = await run(500, 'continue')
    expect(carried.output).toMatchObject({ status: 500 })
  })

  it('retries a timeout or a dropped connection', async () => {
    const timeout = setup(() => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    }).executor
    await expect(timeout.run({ tx: fakeTx(), ctx: ctx(), config: config() })).rejects.toMatchObject(
      {
        retryable: true,
      },
    )
    const reset = setup(() => {
      throw new TypeError('fetch failed')
    }).executor
    await expect(reset.run({ tx: fakeTx(), ctx: ctx(), config: config() })).rejects.toMatchObject({
      retryable: true,
    })
  })

  it('caps requests per store per second', async () => {
    const { executor } = setup(undefined, { rateLimit: createMemoryRateLimitStore() })
    const go = () => executor.run({ tx: fakeTx(), ctx: ctx(), config: config() })
    for (let i = 0; i < 10; i++) await go()
    await expect(go()).rejects.toMatchObject({ retryable: true })
  })

  it('previews without calling out', async () => {
    const { executor, fetch } = setup()
    const p = await executor.preview({ tx: fakeTx(), ctx: ctx({ dryRun: true }), config: config() })
    expect(p).toMatchObject({
      wouldRun: true,
      summary: 'Would POST to https://hooks.example.com/order/1042 with body {"order":"1042"}',
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('SSRF guard', () => {
  const blocked = [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.9',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ]

  it.each(blocked)('refuses a host resolving to %s, without retry', async (ip) => {
    const { executor, fetch } = setup(undefined, { lookup: async () => [ip] })
    await expect(
      executor.run({ tx: fakeTx(), ctx: ctx(), config: config() }),
    ).rejects.toMatchObject({ retryable: false, code: 'AUTOMATION_URL_BLOCKED' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refuses when any of several addresses is private', async () => {
    const { executor } = setup(undefined, { lookup: async () => ['93.184.216.34', '10.0.0.1'] })
    await expect(
      executor.run({ tx: fakeTx(), ctx: ctx(), config: config() }),
    ).rejects.toMatchObject({ retryable: false })
  })

  it('refuses literal private IPs and localhost names', async () => {
    const { executor } = setup(undefined, {
      lookup: async (host) => (host === 'localhost' ? ['127.0.0.1'] : ['93.184.216.34']),
    })
    for (const url of ['https://127.0.0.1/hook', 'https://[::1]/hook', 'https://localhost/hook']) {
      await expect(
        executor.run({ tx: fakeTx(), ctx: ctx(), config: config({ url }) }),
      ).rejects.toMatchObject({ retryable: false })
    }
  })

  it('checks every redirect hop of a GET', async () => {
    const { executor, fetch } = setup(
      (url) =>
        url.includes('public')
          ? new Response(null, { status: 302, headers: { location: 'https://internal.example/' } })
          : new Response('secret', { status: 200 }),
      {
        lookup: async (host) => (host === 'internal.example' ? ['10.0.0.5'] : ['93.184.216.34']),
      },
    )
    await expect(
      executor.run({
        tx: fakeTx(),
        ctx: ctx(),
        config: config({ method: 'GET', url: 'https://public.example/' }),
      }),
    ).rejects.toMatchObject({ retryable: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
