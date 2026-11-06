/** SOURCE OF TRUTH: Cloudflare client tests — WHAT: request shapes, the Bearer header, response parsing, errors and timeouts with a fake fetch / WHY: tests never call the real API and the token must never leak */
import { describe, expect, it } from 'vitest'
import {
  type CloudflareConfig,
  CloudflareError,
  cloudflareConfigFrom,
  createCloudflareClient,
} from './cloudflare'

const config: CloudflareConfig = {
  apiToken: 'secret-token-123',
  zoneId: '023e105f4ecef8ad9ca31a8372d0c353',
}
const BASE = `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames`
const ID = '0d89c70d-ad9f-4843-b99f-6cc0252067e9'

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
const ok = (result: unknown) => json({ success: true, errors: [], messages: [], result })

/** Trimmed to the fields the docs list for a custom hostname. */
const apiHostname = {
  id: ID,
  hostname: 'www.brand.in',
  status: 'pending',
  verification_errors: ['custom hostname does not CNAME to this zone.'],
  ownership_verification: {
    type: 'txt',
    name: '_cf-custom-hostname.www.brand.in',
    value: '5cc07c04-ea62-4a5a-95f0-419334a875a4',
  },
  ownership_verification_http: { http_url: 'http://x', http_body: 'y' },
  ssl: {
    status: 'pending_validation',
    method: 'http',
    type: 'dv',
    validation_errors: [{ message: 'SERVFAIL looking up CAA for brand.in' }],
    validation_records: [
      { http_url: 'http://www.brand.in/.well-known/x', http_body: 'b' },
      { txt_name: '_acme-challenge.www.brand.in', txt_value: 'token' },
    ],
  },
}

describe('cloudflareConfigFrom', () => {
  it('is null unless the token and the zone are both set', () => {
    expect(cloudflareConfigFrom({})).toBeNull()
    expect(cloudflareConfigFrom({ CLOUDFLARE_API_TOKEN: 't' })).toBeNull()
    expect(cloudflareConfigFrom({ CLOUDFLARE_ZONE_ID: 'z' })).toBeNull()
    expect(cloudflareConfigFrom({ CLOUDFLARE_API_TOKEN: 't', CLOUDFLARE_ZONE_ID: 'z' })).toEqual({
      apiToken: 't',
      zoneId: 'z',
    })
  })
})

describe('createCloudflareClient', () => {
  it('finds by exact hostname with the token in the Authorization header only', async () => {
    const f = fakeFetch(() => ok([apiHostname]))
    const found = await createCloudflareClient(config, { fetch: f.fetch }).find('www.brand.in')
    expect(found).toEqual({
      id: ID,
      hostname: 'www.brand.in',
      status: 'pending',
      verificationErrors: ['custom hostname does not CNAME to this zone.'],
      ownership: {
        name: '_cf-custom-hostname.www.brand.in',
        value: '5cc07c04-ea62-4a5a-95f0-419334a875a4',
      },
      ssl: {
        status: 'pending_validation',
        validationErrors: ['SERVFAIL looking up CAA for brand.in'],
        txt: [{ name: '_acme-challenge.www.brand.in', value: 'token' }],
      },
    })
    const [call] = f.calls
    expect(call?.url).toBe(`${BASE}?hostname.exact=www.brand.in`)
    expect(call?.init.method).toBe('GET')
    const headers = call?.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer secret-token-123')
    expect(call?.url).not.toContain('secret-token-123')
    expect(call?.init.signal).toBeInstanceOf(AbortSignal)
    expect(call?.init.redirect).toBe('error')
  })

  it('answers null when the list has no exact match', async () => {
    const f = fakeFetch(() => ok([{ ...apiHostname, hostname: 'shop.brand.in' }]))
    expect(await createCloudflareClient(config, { fetch: f.fetch }).find('www.brand.in')).toBeNull()
    const none = fakeFetch(() => ok([]))
    expect(
      await createCloudflareClient(config, { fetch: none.fetch }).find('www.brand.in'),
    ).toBeNull()
  })

  it('creates with HTTP validation, DV, and TLS 1.2 or later', async () => {
    const f = fakeFetch(() => ok(apiHostname))
    await createCloudflareClient(config, { fetch: f.fetch }).create('www.brand.in')
    const [call] = f.calls
    expect(call?.url).toBe(BASE)
    expect(call?.init.method).toBe('POST')
    expect(JSON.parse(call?.init.body as string)).toEqual({
      hostname: 'www.brand.in',
      ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
    })
  })

  it('refreshes with the same ssl as the create, and deletes by id', async () => {
    const f = fakeFetch(() => ok(apiHostname))
    const client = createCloudflareClient(config, { fetch: f.fetch })
    await client.refresh(ID)
    await client.remove(ID)
    expect(f.calls[0]?.url).toBe(`${BASE}/${ID}`)
    expect(f.calls[0]?.init.method).toBe('PATCH')
    expect(JSON.parse(f.calls[0]?.init.body as string)).toEqual({
      ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
    })
    expect(f.calls[1]?.url).toBe(`${BASE}/${ID}`)
    expect(f.calls[1]?.init.method).toBe('DELETE')
  })

  it('reads a hostname with almost nothing on it without guessing it is live', async () => {
    const f = fakeFetch(() => ok({ id: ID, hostname: 'www.brand.in' }))
    expect(await createCloudflareClient(config, { fetch: f.fetch }).create('www.brand.in')).toEqual(
      {
        id: ID,
        hostname: 'www.brand.in',
        status: 'pending',
        verificationErrors: [],
        ownership: null,
        ssl: { status: 'initializing', validationErrors: [], txt: [] },
      },
    )
  })

  it('turns a non-2xx answer into a CloudflareError that never quotes the token or the body', async () => {
    const f = fakeFetch(() => json({ errors: [{ message: 'bad secret-token-123' }] }, 403))
    const err = await createCloudflareClient(config, { fetch: f.fetch })
      .find('www.brand.in')
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CloudflareError)
    expect((err as CloudflareError).status).toBe(403)
    expect((err as Error).message).toBe('Cloudflare custom_hostnames.list answered 403')
    expect((err as Error).message).not.toContain('secret-token-123')
  })

  it('counts only a real refusal as one, never auth, a rate limit or an outage', async () => {
    const refused = async (status: number) => {
      const f = fakeFetch(() => json({}, status))
      const err = await createCloudflareClient(config, { fetch: f.fetch })
        .create('www.brand.in')
        .catch((e: unknown) => e)
      return (err as CloudflareError).refused
    }
    expect(await refused(400)).toBe(true)
    expect(await refused(409)).toBe(true)
    expect(await refused(401)).toBe(false)
    expect(await refused(403)).toBe(false)
    expect(await refused(429)).toBe(false)
    expect(await refused(500)).toBe(false)
  })

  it('treats a 200 with success: false as a failure', async () => {
    const f = fakeFetch(() => json({ success: false, errors: [{ code: 1000, message: 'x' }] }))
    await expect(
      createCloudflareClient(config, { fetch: f.fetch }).find('www.brand.in'),
    ).rejects.toThrow(/success: false/)
  })

  it('reports an unreachable API, an odd answer and a slow answer as CloudflareErrors', async () => {
    const down = async () => {
      throw new TypeError('fetch failed')
    }
    await expect(
      createCloudflareClient(config, { fetch: down }).find('www.brand.in'),
    ).rejects.toThrow(/could not be reached/)
    const html = fakeFetch(() => new Response('<html>', { status: 200 }))
    await expect(
      createCloudflareClient(config, { fetch: html.fetch }).find('www.brand.in'),
    ).rejects.toThrow(/other than JSON/)
    const notList = fakeFetch(() => ok({ id: ID }))
    await expect(
      createCloudflareClient(config, { fetch: notList.fetch }).find('www.brand.in'),
    ).rejects.toThrow(/did not answer a list/)
    const noHost = fakeFetch(() => ok({}))
    await expect(
      createCloudflareClient(config, { fetch: noHost.fetch }).create('www.brand.in'),
    ).rejects.toThrow(/without a hostname/)
    const hang = (_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    await expect(
      createCloudflareClient(config, { fetch: hang, timeoutMs: 20 }).find('www.brand.in'),
    ).rejects.toThrow(/timed out/)
  })
})
