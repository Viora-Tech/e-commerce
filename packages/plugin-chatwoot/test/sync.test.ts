import { encryptSecret } from '@commerce/core'
import { describe, expect, it, vi } from 'vitest'
import { chatwootClient } from '../src/client'
import type { CustomerFacts } from '../src/contact'
import { chatwootApi, chatwootConversationsFor, syncChatwootContact } from '../src/server'
import { parseChatwootSettings } from '../src/settings'
import { fakeChatwoot, json, lookup } from './fake-chatwoot'

const facts: CustomerFacts = {
  id: '01a134be-8765-7038-8c41-08a2179577bb',
  name: 'Asha Mehta',
  email: 'asha@example.com',
  phone: '+919876543210',
  createdAt: new Date('2025-03-04T10:00:00Z'),
  orderCount: 2,
  spentPaise: 150_000,
  lastOrderNumber: 1041,
  lastOrderAt: new Date('2026-09-30T08:00:00Z'),
}

const clientOf = (fake: ReturnType<typeof fakeChatwoot>) =>
  chatwootClient({
    baseUrl: 'https://cw.shop.in',
    accountId: fake.accountId,
    apiToken: fake.token,
    fetch: fake.fn,
    lookup,
  })

const writes = (fake: ReturnType<typeof fakeChatwoot>) =>
  fake.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`)

describe('syncChatwootContact', () => {
  it('creates the contact once, then leaves it alone while nothing changed', async () => {
    const fake = fakeChatwoot()
    const client = clientOf(fake)
    expect(await syncChatwootContact(client, facts)).toEqual({ action: 'created', contactId: 100 })
    expect(fake.contacts[0]).toMatchObject({
      identifier: facts.id,
      phone_number: '+919876543210',
      custom_attributes: { orders_count: 2, total_spent: 1500, last_order: '#1041' },
    })
    expect(await syncChatwootContact(client, facts)).toEqual({
      action: 'unchanged',
      contactId: 100,
    })
    expect(writes(fake)).toEqual(['POST /api/v1/accounts/3/contacts'])
  })

  it('updates the contact when the customer changed', async () => {
    const fake = fakeChatwoot()
    const client = clientOf(fake)
    await syncChatwootContact(client, facts)
    const next = { ...facts, name: 'Asha M.', orderCount: 3, lastOrderNumber: 1042 }
    expect(await syncChatwootContact(client, next)).toEqual({ action: 'updated', contactId: 100 })
    expect(fake.contacts[0]).toMatchObject({
      name: 'Asha M.',
      custom_attributes: { orders_count: 3, last_order: '#1042' },
    })
  })

  it('claims the guest contact that chatted with the same email, instead of a duplicate', async () => {
    const fake = fakeChatwoot()
    fake.contacts.push({
      id: 5,
      name: 'asha',
      email: 'asha@example.com',
      phone_number: null,
      identifier: null,
      custom_attributes: {},
    })
    expect(await syncChatwootContact(clientOf(fake), facts)).toEqual({
      action: 'updated',
      contactId: 5,
    })
    expect(fake.contacts).toHaveLength(1)
    expect(fake.contacts[0]?.identifier).toBe(facts.id)
  })

  it('never takes over a contact tied to another customer; drops the clashing email instead', async () => {
    const fake = fakeChatwoot()
    fake.contacts.push({
      id: 5,
      name: 'Someone',
      email: 'asha@example.com',
      phone_number: null,
      identifier: 'another-customer',
      custom_attributes: {},
    })
    const r = await syncChatwootContact(clientOf(fake), facts)
    expect(r.action).toBe('created')
    expect(fake.contacts[1]).toMatchObject({ identifier: facts.id, email: null })
    expect(fake.contacts[0]?.identifier).toBe('another-customer')
  })

  it('a rate limit throws, so the worker retries with backoff', async () => {
    const fake = fakeChatwoot()
    fake.failNext.push(json({}, 429, { 'retry-after': '5' }))
    await expect(syncChatwootContact(clientOf(fake), facts)).rejects.toMatchObject({
      code: 'rate-limited',
    })
    expect(fake.contacts).toHaveLength(0)
  })
})

describe('chatwootConversationsFor', () => {
  const SECRET = 'a'.repeat(32)
  const apiFor = (fake: ReturnType<typeof fakeChatwoot>) => {
    const api = chatwootApi(
      parseChatwootSettings({
        baseUrl: 'https://cw.shop.in',
        accountId: fake.accountId,
        apiToken: encryptSecret(fake.token, SECRET),
      }),
      SECRET,
      { fetch: fake.fn, lookup },
    )
    if (!api) throw new Error('api')
    return api
  }

  it('no API until the address, account and token are saved', () => {
    expect(chatwootApi(parseChatwootSettings({ baseUrl: 'https://cw.shop.in' }), SECRET)).toBeNull()
    expect(
      chatwootApi(
        parseChatwootSettings({ baseUrl: 'https://cw.shop.in', accountId: '3', apiToken: 'junk' }),
        SECRET,
      ),
    ).toBeNull()
  })

  it('lists the contact’s conversations with dashboard links', async () => {
    const fake = fakeChatwoot()
    await syncChatwootContact(clientOf(fake), facts)
    fake.conversations.set(100, [
      { id: 12, status: 'open', last_activity_at: 1_800_000_000, messages: [{ content: 'Hi' }] },
    ])
    const view = await chatwootConversationsFor(apiFor(fake), facts)
    expect(view).toMatchObject({
      state: 'ready',
      contactUrl: 'https://cw.shop.in/app/accounts/3/contacts/100',
      conversations: [
        { id: 12, preview: 'Hi', url: 'https://cw.shop.in/app/accounts/3/conversations/12' },
      ],
    })
  })

  it('no contact yet, or Chatwoot down: a state the card can draw, never a throw', async () => {
    const fake = fakeChatwoot()
    expect(await chatwootConversationsFor(apiFor(fake), facts)).toEqual({
      state: 'no-contact',
      dashboardUrl: 'https://cw.shop.in/app/accounts/3/dashboard',
    })
    fake.failNext.push(new Response('', { status: 503 }))
    expect(await chatwootConversationsFor(apiFor(fake), facts)).toMatchObject({ state: 'error' })
  })
})

vi.mock('../src/server', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/server')>()
  return {
    ...real,
    loadChatwootSettings: vi.fn(),
    loadCustomerFacts: vi.fn(),
  }
})

describe('syncCustomerToChatwoot (the worker hook)', () => {
  const SECRET = 'b'.repeat(32)

  async function run(settings: Record<string, unknown>, fake: ReturnType<typeof fakeChatwoot>) {
    const server = await import('../src/server')
    const { syncCustomerToChatwoot } = await import('../src/plugin')
    vi.mocked(server.loadChatwootSettings).mockResolvedValue({
      installed: true,
      settings: parseChatwootSettings(settings),
    })
    vi.mocked(server.loadCustomerFacts).mockResolvedValue(facts)
    const said: string[] = []
    await syncCustomerToChatwoot(
      {
        storeId: 's1',
        settingsSecret: SECRET,
        inStore: async (fn) => fn({} as never),
        reportActivity: (s) => said.push(s),
      },
      facts.id,
      { fetch: fake.fn, lookup },
    )
    return said
  }

  const connected = (fake: ReturnType<typeof fakeChatwoot>) => ({
    baseUrl: 'https://cw.shop.in',
    accountId: fake.accountId,
    apiToken: encryptSecret(fake.token, SECRET),
  })

  it('upserts the contact and says so on the Installed apps list', async () => {
    const fake = fakeChatwoot()
    expect(await run(connected(fake), fake)).toEqual(['Added Asha Mehta to Chatwoot'])
    expect(await run(connected(fake), fake)).toEqual([])
    expect(fake.contacts).toHaveLength(1)
  })

  it('does nothing with syncing off or the API not set up', async () => {
    const fake = fakeChatwoot()
    await run({ ...connected(fake), syncContacts: false }, fake)
    await run({ baseUrl: 'https://cw.shop.in' }, fake)
    expect(fake.calls).toHaveLength(0)
  })
})
