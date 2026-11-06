/** SOURCE OF TRUTH: Dokploy client tests — WHAT: request shapes, headers, errors and timeouts with a fake fetch / WHY: tests never call a real Dokploy and the API key must never leak */
import { describe, expect, it } from 'vitest'
import { createDokployClient, type DokployConfig, dokployConfigFrom } from './dokploy'

const config: DokployConfig = {
  url: 'https://dokploy.example.com/',
  apiKey: 'secret-key-123',
  applicationId: 'app_1',
  port: 3100,
}

type Call = { url: string; init: RequestInit }

function fakeFetch(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetch = async (url: string, init: RequestInit) => {
    const call = { url, init }
    calls.push(call)
    return answer(call)
  }
  return { calls, fetch }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('dokployConfigFrom', () => {
  it('is null unless URL, key and application id are all set', () => {
    const port = { DOKPLOY_STOREFRONT_PORT: 3100 }
    expect(dokployConfigFrom(port)).toBeNull()
    expect(
      dokployConfigFrom({ ...port, DOKPLOY_URL: 'https://d', DOKPLOY_API_KEY: 'k' }),
    ).toBeNull()
    expect(
      dokployConfigFrom({
        ...port,
        DOKPLOY_URL: 'https://d',
        DOKPLOY_API_KEY: 'k',
        DOKPLOY_STOREFRONT_APPLICATION_ID: 'a',
      }),
    ).toEqual({ url: 'https://d', apiKey: 'k', applicationId: 'a', port: 3100 })
  })
})

describe('apex middleware', () => {
  const keys = {
    DOKPLOY_STOREFRONT_PORT: 3100,
    DOKPLOY_URL: 'https://d',
    DOKPLOY_API_KEY: 'k',
    DOKPLOY_STOREFRONT_APPLICATION_ID: 'a',
  }

  it('is set only on the cloudflare provider', () => {
    expect(dokployConfigFrom({ ...keys, DOMAIN_PROVIDER: 'cloudflare' })?.apexMiddleware).toBe(
      'apex-to-www@file',
    )
    expect(dokployConfigFrom({ ...keys, DOMAIN_PROVIDER: 'dns' })?.apexMiddleware).toBeUndefined()
  })
})

describe('createDokployClient', () => {
  it('lists the storefront app domains with the key in the x-api-key header only', async () => {
    const f = fakeFetch(() =>
      json([
        { domainId: 'd1', host: 'brand.in', port: 3100 },
        { domainId: 'd2', host: 'www.brand.in' },
        { nope: true },
      ]),
    )
    const client = createDokployClient(config, { fetch: f.fetch })
    expect(await client.listDomains()).toEqual([
      { domainId: 'd1', host: 'brand.in' },
      { domainId: 'd2', host: 'www.brand.in' },
    ])
    const [call] = f.calls
    expect(call?.url).toBe(
      'https://dokploy.example.com/api/domain.byApplicationId?applicationId=app_1',
    )
    expect(call?.init.method).toBe('GET')
    const headers = call?.init.headers as Record<string, string> | undefined
    expect(headers?.['x-api-key']).toBe('secret-key-123')
    expect(call?.url).not.toContain('secret-key-123')
    expect(call?.init.signal).toBeInstanceOf(AbortSignal)
  })

  it('accepts a base URL that already ends in /api', async () => {
    const f = fakeFetch(() => json([]))
    await createDokployClient(
      { ...config, url: 'https://d.example.com/api' },
      { fetch: f.fetch },
    ).listDomains()
    expect(f.calls[0]?.url).toBe(
      'https://d.example.com/api/domain.byApplicationId?applicationId=app_1',
    )
  })

  it('creates an https Let’s Encrypt domain on the storefront app at path /', async () => {
    const f = fakeFetch(() => json({ domainId: 'd9', host: 'brand.in' }))
    const client = createDokployClient(config, { fetch: f.fetch })
    expect(await client.createDomain('brand.in')).toEqual({ domainId: 'd9', host: 'brand.in' })
    const [call] = f.calls
    expect(call?.url).toBe('https://dokploy.example.com/api/domain.create')
    expect(call?.init.method).toBe('POST')
    expect(JSON.parse(call?.init.body as string)).toEqual({
      host: 'brand.in',
      path: '/',
      internalPath: '/',
      stripPath: false,
      port: 3100,
      https: true,
      certificateType: 'letsencrypt',
      applicationId: 'app_1',
      domainType: 'application',
    })
  })

  it('sends middlewares only when asked, and keeps them from the answer', async () => {
    const f = fakeFetch(() =>
      json({ domainId: 'd9', host: 'brand.in', middlewares: ['apex-to-www@file'] }),
    )
    const client = createDokployClient(config, { fetch: f.fetch })
    expect(await client.createDomain('brand.in', { middlewares: ['apex-to-www@file'] })).toEqual({
      domainId: 'd9',
      host: 'brand.in',
      middlewares: ['apex-to-www@file'],
    })
    expect(JSON.parse(f.calls[0]?.init.body as string)).toMatchObject({
      middlewares: ['apex-to-www@file'],
    })
  })

  it('takes the domain back and fails when Dokploy drops the middleware (before 0.29.0)', async () => {
    const f = fakeFetch(() => json({ domainId: 'd9', host: 'brand.in' }))
    const client = createDokployClient(config, { fetch: f.fetch })
    await expect(
      client.createDomain('brand.in', { middlewares: ['apex-to-www@file'] }),
    ).rejects.toThrow(/0\.29\.0/)
    expect(f.calls.map((c) => c.url)).toEqual([
      'https://dokploy.example.com/api/domain.create',
      'https://dokploy.example.com/api/domain.delete',
    ])
  })

  it('reads middlewares from the list', async () => {
    const f = fakeFetch(() =>
      json([{ domainId: 'd1', host: 'brand.in', middlewares: ['apex-to-www@file', 7] }]),
    )
    expect(await createDokployClient(config, { fetch: f.fetch }).listDomains()).toEqual([
      { domainId: 'd1', host: 'brand.in', middlewares: ['apex-to-www@file'] },
    ])
  })

  it('deletes by domain id', async () => {
    const f = fakeFetch(() => json({ domainId: 'd1' }))
    await createDokployClient(config, { fetch: f.fetch }).deleteDomain('d1')
    expect(f.calls[0]?.url).toBe('https://dokploy.example.com/api/domain.delete')
    expect(JSON.parse(f.calls[0]?.init.body as string)).toEqual({ domainId: 'd1' })
  })

  it('turns a non-2xx answer into a DokployError that never quotes the key or the body', async () => {
    const f = fakeFetch(() => json({ message: 'bad key secret-key-123' }, 401))
    const err = await createDokployClient(config, { fetch: f.fetch })
      .listDomains()
      .catch((e: unknown) => e)
    expect((err as Error).name).toBe('DokployError')
    expect((err as { status?: unknown }).status).toBe(401)
    expect((err as Error).message).toBe('Dokploy domain.byApplicationId answered 401')
    expect((err as Error).message).not.toContain('secret-key-123')
  })

  it('fails a request that takes too long', async () => {
    const hang = (_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    const err = await createDokployClient(config, { fetch: hang, timeoutMs: 20 })
      .createDomain('brand.in')
      .catch((e: unknown) => e)
    expect((err as Error).name).toBe('DokployError')
    expect((err as Error).message).toMatch(/timed out/)
  })

  it('reports an unreachable Dokploy or an odd answer as a DokployError', async () => {
    const down = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(createDokployClient(config, { fetch: down }).listDomains()).rejects.toThrow(
      /could not be reached/,
    )
    const html = fakeFetch(() => new Response('<html>', { status: 200 }))
    await expect(
      createDokployClient(config, { fetch: html.fetch }).listDomains(),
    ).rejects.toMatchObject({ name: 'DokployError' })
    const notList = fakeFetch(() => json({ domainId: 'x' }))
    await expect(
      createDokployClient(config, { fetch: notList.fetch }).listDomains(),
    ).rejects.toThrow(/did not answer a list/)
    const noDomain = fakeFetch(() => json({}))
    await expect(
      createDokployClient(config, { fetch: noDomain.fetch }).createDomain('brand.in'),
    ).rejects.toThrow(/without a domain/)
  })
})
