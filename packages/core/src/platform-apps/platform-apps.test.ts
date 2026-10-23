/** SOURCE OF TRUTH: platform app tests — WHAT: signature checks, WhatsApp Embedded Signup calls, Meta webhook mapping / WHY: every outside callback is verified, and no test reaches Meta */
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { metaAuthorizeUrl, metaExchangeCode } from '../sales-channels/providers'
import { googleRejectedItems, metaRejectedItems } from '../sales-channels/verdicts'
import { deletionCode, isDeletionCode, whatsappEventUpdate } from './meta-callbacks'
import {
  parseMetaSignedRequest,
  verifyMetaSignature,
  verifyShopifyQueryHmac,
  verifyShopifyWebhook,
} from './signatures'
import { completeWhatsappSignup, whatsappSignupApp } from './whatsapp-signup'

const SECRET = 'app-secret-for-tests'

type Call = { url: string; method: string; body: string }

/** A pretend Graph API: answers by URL part, records every call. */
function fakeFetch(answers: Record<string, unknown>) {
  const calls: Call[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? String(init.body) : '' })
    for (const [part, json] of Object.entries(answers)) {
      if (url.includes(part)) {
        const status = (json as { _status?: number })._status ?? 200
        return new Response(JSON.stringify(json), { status })
      }
    }
    return new Response(JSON.stringify({ error: { message: `unexpected ${url}` } }), {
      status: 500,
    })
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('signatures', () => {
  it('accepts a Meta webhook signed with the app secret and nothing else', () => {
    const body = '{"object":"whatsapp_business_account"}'
    const sig = `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`
    expect(verifyMetaSignature(body, sig, SECRET)).toBe(true)
    expect(verifyMetaSignature(`${body} `, sig, SECRET)).toBe(false)
    expect(verifyMetaSignature(body, sig, 'other')).toBe(false)
    expect(verifyMetaSignature(body, null, SECRET)).toBe(false)
    expect(verifyMetaSignature(body, sig.replace('sha256=', ''), SECRET)).toBe(false)
  })

  it('reads a Meta signed_request only when its signature and algorithm hold', () => {
    const payload = Buffer.from(
      JSON.stringify({ user_id: '12345', algorithm: 'HMAC-SHA256', issued_at: 1 }),
    ).toString('base64url')
    const sig = createHmac('sha256', SECRET).update(payload).digest('base64url')
    expect(parseMetaSignedRequest(`${sig}.${payload}`, SECRET)?.user_id).toBe('12345')
    expect(parseMetaSignedRequest(`${sig}.${payload}`, 'other')).toBeNull()
    const plain = Buffer.from(JSON.stringify({ user_id: '1', algorithm: 'none' })).toString(
      'base64url',
    )
    const plainSig = createHmac('sha256', SECRET).update(plain).digest('base64url')
    expect(parseMetaSignedRequest(`${plainSig}.${plain}`, SECRET)).toBeNull()
    expect(parseMetaSignedRequest('garbage', SECRET)).toBeNull()
  })

  it('checks Shopify webhooks against the base64 HMAC of the raw body', () => {
    const body = '{"shop_domain":"asha.myshopify.com"}'
    const mac = createHmac('sha256', SECRET).update(body).digest('base64')
    expect(verifyShopifyWebhook(body, mac, SECRET)).toBe(true)
    expect(verifyShopifyWebhook(body, mac, 'other')).toBe(false)
    expect(verifyShopifyWebhook(body, undefined, SECRET)).toBe(false)
  })

  it('checks a Shopify OAuth redirect hmac over the sorted query', () => {
    const params = {
      code: 'abc',
      shop: 'asha.myshopify.com',
      state: 'xyz.123',
      timestamp: '1700000000',
    }
    const message = 'code=abc&shop=asha.myshopify.com&state=xyz.123&timestamp=1700000000'
    const hmac = createHmac('sha256', SECRET).update(message).digest('hex')
    const q = new URLSearchParams({ ...params, hmac })
    expect(verifyShopifyQueryHmac(q, SECRET)).toBe(true)
    q.set('shop', 'evil.myshopify.com')
    expect(verifyShopifyQueryHmac(q, SECRET)).toBe(false)
    expect(verifyShopifyQueryHmac(new URLSearchParams(params), SECRET)).toBe(false)
  })
})

describe('Meta sign-in', () => {
  const app = { appId: '111', appSecret: SECRET }

  it('asks for permissions by name without a login configuration, and the configuration with one', () => {
    const byScope = new URL(
      metaAuthorizeUrl({ appId: '111', redirectUri: 'https://a/cb', state: 's' }),
    )
    expect(byScope.pathname).toBe('/v26.0/dialog/oauth')
    expect(byScope.searchParams.get('scope')).toContain('catalog_management')
    expect(byScope.searchParams.get('config_id')).toBeNull()
    const byConfig = new URL(
      metaAuthorizeUrl({ appId: '111', redirectUri: 'https://a/cb', state: 's', configId: '999' }),
    )
    expect(byConfig.searchParams.get('config_id')).toBe('999')
    expect(byConfig.searchParams.get('scope')).toBeNull()
  })

  it('keeps a system user token as it is instead of swapping it for a 60-day one', async () => {
    const { fetchImpl, calls } = fakeFetch({ '/oauth/access_token': { access_token: 'bisu' } })
    const r = await metaExchangeCode(
      fetchImpl,
      { ...app, loginConfigId: '999' },
      { code: 'c', redirectUri: 'https://a/cb' },
    )
    expect(r).toEqual({ token: 'bisu', expiresAt: null })
    expect(calls).toHaveLength(1)
  })
})

describe('what the platform refused', () => {
  it('counts Google products that are not eligible or disapproved', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'reports:search': {
        results: [
          { productView: { offerId: 'v1', itemIssues: [{ type: { code: 'image_too_small' } }] } },
          { productView: { offerId: 'v2' } },
        ],
      },
    })
    const r = await googleRejectedItems(fetchImpl, 'tok', '42')
    expect(r).toEqual({
      count: 2,
      items: [
        { id: 'v1', reason: 'image_too_small' },
        { id: 'v2', reason: 'disapproved' },
      ],
    })
    expect(calls[0]?.url).toBe(
      'https://merchantapi.googleapis.com/reports/v1/accounts/42/reports:search',
    )
    expect(calls[0]?.body).toContain('NOT_ELIGIBLE_OR_DISAPPROVED')
  })

  it('counts Meta catalog items whose review was rejected', async () => {
    const { fetchImpl } = fakeFetch({
      '/products?': {
        data: [
          { retailer_id: 'v1', review_status: 'rejected', errors: [{ title: 'Image missing' }] },
          { retailer_id: 'v2', review_status: 'approved' },
        ],
      },
    })
    const r = await metaRejectedItems(fetchImpl, { appId: '1', appSecret: SECRET }, 'tok', 'cat1')
    expect(r).toEqual({ count: 1, items: [{ id: 'v1', reason: 'Image missing' }] })
  })
})

describe('WhatsApp Embedded Signup', () => {
  const app = { appId: '111', appSecret: SECRET, configId: '222' }
  const input = { code: 'code-from-the-popup', wabaId: '100100', phoneNumberId: '200200' }

  it('is set up only with the app keys and the signup configuration', () => {
    expect(whatsappSignupApp({ META_APP_ID: '1', META_APP_SECRET: 's' })).toBeNull()
    expect(
      whatsappSignupApp({ META_APP_ID: '1', META_APP_SECRET: 's', META_WHATSAPP_CONFIG_ID: '2' }),
    ).toEqual({ appId: '1', appSecret: 's', configId: '2' })
  })

  it('swaps the code, subscribes the app, registers the number and reads its name', async () => {
    const { fetchImpl, calls } = fakeFetch({
      '/oauth/access_token': { access_token: 'business-token' },
      '/100100/subscribed_apps': { success: true },
      '/200200/register': { success: true },
      '/200200?': {
        display_phone_number: '+91 98765 43210',
        verified_name: 'Asha Store',
        quality_rating: 'GREEN',
      },
    })
    const r = await completeWhatsappSignup(fetchImpl, app, input, '123456')
    expect(r).toMatchObject({
      accessToken: 'business-token',
      wabaId: '100100',
      phoneNumberId: '200200',
      pin: '123456',
      registered: true,
      displayPhone: '+91 98765 43210',
      verifiedName: 'Asha Store',
      quality: 'GREEN',
    })
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST', 'POST', 'GET'])
    expect(calls[0]?.url).toContain('code=code-from-the-popup')
    expect(calls[0]?.url).not.toContain('redirect_uri')
    const register = new URLSearchParams(calls[2]?.body)
    expect(register.get('messaging_product')).toBe('whatsapp')
    expect(register.get('pin')).toBe('123456')
    const proof = createHmac('sha256', SECRET).update('business-token').digest('hex')
    expect(new URLSearchParams(calls[1]?.body).get('appsecret_proof')).toBe(proof)
  })

  it('still connects when Meta will not register the number, and says why', async () => {
    const { fetchImpl } = fakeFetch({
      '/oauth/access_token': { access_token: 'business-token' },
      '/100100/subscribed_apps': { success: true },
      '/200200/register': { _status: 400, error: { message: 'Number already registered' } },
      '/200200?': {},
    })
    const r = await completeWhatsappSignup(fetchImpl, app, input, '123456')
    expect(r.registered).toBe(false)
    expect(r.registerError).toBe('Number already registered')
  })

  it('stops with Meta’s words when the code is refused', async () => {
    const { fetchImpl } = fakeFetch({
      '/oauth/access_token': { _status: 400, error: { message: 'Code expired' } },
    })
    await expect(completeWhatsappSignup(fetchImpl, app, input)).rejects.toThrow('Code expired')
  })

  it('refuses ids that are not Meta ids', async () => {
    const { fetchImpl, calls } = fakeFetch({})
    await expect(
      completeWhatsappSignup(fetchImpl, app, { ...input, wabaId: 'abc' }),
    ).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })
})

describe('Meta callbacks', () => {
  it('maps WhatsApp webhook changes to what the account page shows', () => {
    expect(
      whatsappEventUpdate({ field: 'account_update', value: { event: 'ACCOUNT_RESTRICTION' } }),
    ).toEqual({ status: 'restricted', detail: { lastAccountEvent: 'ACCOUNT_RESTRICTION' } })
    expect(
      whatsappEventUpdate({
        field: 'phone_number_quality_update',
        value: { event: 'FLAGGED', current_limit: 'TIER_1K' },
      }),
    ).toEqual({ detail: { quality: 'FLAGGED', limit: 'TIER_1K' } })
    expect(
      whatsappEventUpdate({
        field: 'messages',
        value: { statuses: [{ status: 'failed', errors: [{ title: 'Re-engagement message' }] }] },
      }),
    ).toEqual({ detail: { lastFailure: 'Re-engagement message' } })
    expect(
      whatsappEventUpdate({ field: 'messages', value: { statuses: [{ status: 'read' }] } }),
    ).toBeNull()
    expect(whatsappEventUpdate({ field: 'something_else' })).toBeNull()
  })

  it('recognises only deletion codes it signed', () => {
    const code = deletionCode(SECRET)
    expect(isDeletionCode(code, SECRET)).toBe(true)
    expect(isDeletionCode(code, 'other')).toBe(false)
    expect(isDeletionCode('made-up', SECRET)).toBe(false)
  })
})
