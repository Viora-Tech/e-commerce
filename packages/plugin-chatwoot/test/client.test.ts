import { describe, expect, it } from 'vitest'
import { ChatwootError, chatwootClient, parseTrustedOrigins, toConversation } from '../src/client'
import { fakeChatwoot, json, lookup } from './fake-chatwoot'

const client = (fake: ReturnType<typeof fakeChatwoot>, over: { apiToken?: string } = {}) =>
  chatwootClient({
    baseUrl: 'https://cw.shop.in',
    accountId: fake.accountId,
    apiToken: over.apiToken ?? fake.token,
    fetch: fake.fn,
    lookup,
  })

describe('chatwootClient', () => {
  it('sends the token in api_access_token and reads the profile', async () => {
    const fake = fakeChatwoot()
    const profile = await client(fake).profile()
    expect(profile).toEqual({ name: 'Asha (agent)', accountIds: ['3'] })
    expect(fake.calls[0]?.path).toBe('/api/v1/profile')
    expect(fake.calls[0]?.headers.get('api_access_token')).toBe('tok')
  })

  it('lists inboxes with the website token', async () => {
    const fake = fakeChatwoot()
    const inboxes = await client(fake).inboxes()
    expect(inboxes.find((i) => i.websiteToken === 'webtok12345')).toMatchObject({
      id: 2,
      channelType: 'Channel::WebWidget',
    })
  })

  it('a wrong token is unauthorized; a wrong account is not found', async () => {
    const fake = fakeChatwoot()
    await expect(client(fake, { apiToken: 'nope' }).profile()).rejects.toMatchObject({
      code: 'unauthorized',
    })
    const other = chatwootClient({
      baseUrl: 'https://cw.shop.in',
      accountId: '99',
      apiToken: 'tok',
      fetch: fake.fn,
      lookup,
    })
    await expect(other.inboxes()).rejects.toMatchObject({ code: 'not-found' })
  })

  it('creates, searches and updates contacts, unwrapping Chatwoot payloads', async () => {
    const fake = fakeChatwoot()
    const c = client(fake)
    const created = await c.createContact({
      identifier: 'cust-1',
      name: 'Asha',
      email: 'asha@example.com',
      custom_attributes: { orders_count: 1 },
    })
    expect(created).toMatchObject({ id: 100, identifier: 'cust-1', email: 'asha@example.com' })
    expect((await c.searchContacts('cust-1')).map((x) => x.id)).toEqual([100])
    expect(fake.calls.at(-1)?.search).toContain('q=cust-1')
    const updated = await c.updateContact(100, { name: 'Asha M.' })
    expect(updated.name).toBe('Asha M.')
    expect(fake.calls.at(-1)?.method).toBe('PUT')
  })

  it('a 422 is invalid with Chatwoot’s message', async () => {
    const fake = fakeChatwoot()
    const c = client(fake)
    await c.createContact({ identifier: 'a', email: 'x@example.com', custom_attributes: {} })
    const err = await c
      .createContact({ identifier: 'b', email: 'x@example.com', custom_attributes: {} })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ChatwootError)
    expect((err as ChatwootError).code).toBe('invalid')
    expect((err as ChatwootError).message).toContain('Email has already been taken')
  })

  it('a 429 is rate-limited with the wait Chatwoot asked for', async () => {
    const fake = fakeChatwoot()
    fake.failNext.push(json({ error: 'slow down' }, 429, { 'retry-after': '30' }))
    const err = (await client(fake)
      .searchContacts('x')
      .catch((e: unknown) => e)) as ChatwootError
    expect(err.code).toBe('rate-limited')
    expect(err.retryAfter).toBe(30)
  })

  it('a 5xx or a network failure is unreachable; HTML is a bad response', async () => {
    const fake = fakeChatwoot()
    fake.failNext.push(new Response('oops', { status: 502 }))
    await expect(client(fake).profile()).rejects.toMatchObject({ code: 'unreachable' })
    fake.failNext.push(new Response('<html></html>', { status: 200 }))
    await expect(client(fake).profile()).rejects.toMatchObject({ code: 'bad-response' })
    const down = chatwootClient({
      baseUrl: 'https://cw.shop.in',
      accountId: '3',
      apiToken: 'tok',
      fetch: (async () => {
        throw new TypeError('fetch failed')
      }) as typeof fetch,
      lookup,
    })
    await expect(down.profile()).rejects.toMatchObject({ code: 'unreachable' })
  })

  it('refuses a private address unless the platform trusts it', async () => {
    const fake = fakeChatwoot()
    const privateLookup = async () => ['10.0.0.5']
    const blocked = chatwootClient({
      baseUrl: 'https://chatwoot.internal',
      accountId: '3',
      apiToken: 'tok',
      fetch: fake.fn,
      lookup: privateLookup,
    })
    await expect(blocked.profile()).rejects.toMatchObject({ code: 'unreachable' })
    expect(fake.calls).toHaveLength(0)
    const trusted = chatwootClient({
      baseUrl: 'http://chatwoot:3000',
      accountId: '3',
      apiToken: 'tok',
      fetch: fake.fn,
      trustedOrigins: parseTrustedOrigins('http://chatwoot:3000, not a url'),
    })
    await expect(trusted.profile()).resolves.toMatchObject({ accountIds: ['3'] })
  })

  it('lists a contact’s conversations, newest activity first, with a short preview', async () => {
    const fake = fakeChatwoot()
    fake.conversations.set(5, [
      { id: 11, status: 'resolved', inbox_id: 2, last_activity_at: 1_700_000_000, messages: [] },
      {
        id: 12,
        status: 'open',
        inbox_id: 2,
        unread_count: 2,
        last_activity_at: 1_800_000_000,
        messages: [{ content: 'Where is my order?' }, { content: '' }],
      },
    ])
    const list = await client(fake).contactConversations(5)
    expect(list.map((c) => c.id)).toEqual([12, 11])
    expect(list[0]).toMatchObject({ status: 'open', unreadCount: 2, preview: 'Where is my order?' })
    expect(list[0]?.lastActivityAt?.toISOString()).toBe('2027-01-15T08:00:00.000Z')
  })
})

describe('toConversation', () => {
  it('reads odd shapes defensively', () => {
    expect(toConversation(null)).toBeNull()
    expect(toConversation({ id: 'x' })).toBeNull()
    expect(toConversation({ id: 3, status: 'weird', messages: 'no' })).toMatchObject({
      id: 3,
      status: 'open',
      preview: null,
      lastActivityAt: null,
    })
    const long = 'a'.repeat(200)
    expect(toConversation({ id: 3, messages: [{ content: long }] })?.preview).toHaveLength(140)
  })
})
