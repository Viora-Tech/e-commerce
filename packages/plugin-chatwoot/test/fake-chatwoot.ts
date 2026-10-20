/**
 * A fake Chatwoot Application API in memory: contacts, search, create, update and a contact's
 * conversations, plus the profile and inboxes. Records every call; no network.
 */

type Contact = {
  id: number
  name: string | null
  email: string | null
  phone_number: string | null
  identifier: string | null
  custom_attributes: Record<string, unknown>
}

export type Call = { method: string; path: string; search: string; headers: Headers; body: unknown }

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })

/** Every host resolves to a public address. */
export const lookup = async () => ['93.184.216.34']

export function fakeChatwoot(opts: { accountId?: string; token?: string } = {}) {
  const accountId = opts.accountId ?? '3'
  const token = opts.token ?? 'tok'
  const contacts: Contact[] = []
  const conversations = new Map<number, unknown[]>()
  const calls: Call[] = []
  let nextId = 100
  /** Answer the next N requests with this status (rate limits, outages). */
  const failNext: Response[] = []

  const prefix = `/api/v1/accounts/${accountId}`

  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path: url.pathname, search: url.search, headers, body })
    const queued = failNext.shift()
    if (queued) return queued
    if (headers.get('api_access_token') !== token) return json({ error: 'Invalid' }, 401)
    const path = url.pathname

    if (method === 'GET' && path === '/api/v1/profile') {
      return json({ name: 'Asha (agent)', accounts: [{ id: Number(accountId), name: 'Store' }] })
    }
    if (!path.startsWith(prefix)) return json({ error: 'Not found' }, 404)
    const rest = path.slice(prefix.length)

    if (method === 'GET' && rest === '/inboxes') {
      return json({
        payload: [
          { id: 1, name: 'Email', channel_type: 'Channel::Email' },
          {
            id: 2,
            name: 'Website',
            channel_type: 'Channel::WebWidget',
            website_token: 'webtok12345',
          },
        ],
      })
    }
    if (method === 'GET' && rest === '/contacts/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const found = contacts.filter((c) =>
        [c.name, c.email, c.phone_number, c.identifier].some((v) => v?.toLowerCase().includes(q)),
      )
      return json({ meta: { count: found.length }, payload: found })
    }
    if (method === 'POST' && rest === '/contacts') {
      const b = body as Partial<Contact>
      if (b.email && contacts.some((c) => c.email === b.email)) {
        return json({ message: 'Email has already been taken' }, 422)
      }
      const contact: Contact = {
        id: nextId++,
        name: b.name ?? null,
        email: b.email ?? null,
        phone_number: b.phone_number ?? null,
        identifier: b.identifier ?? null,
        custom_attributes: b.custom_attributes ?? {},
      }
      contacts.push(contact)
      return json({ payload: { contact, contact_inbox: null } })
    }
    const one = /^\/contacts\/(\d+)$/.exec(rest)
    if (method === 'PUT' && one) {
      const contact = contacts.find((c) => c.id === Number(one[1]))
      if (!contact) return json({ error: 'Not found' }, 404)
      Object.assign(contact, body as Partial<Contact>)
      return json({ payload: contact })
    }
    const convs = /^\/contacts\/(\d+)\/conversations$/.exec(rest)
    if (method === 'GET' && convs) {
      return json({ payload: conversations.get(Number(convs[1])) ?? [] })
    }
    return json({ error: 'Not found' }, 404)
  }) as typeof fetch

  return { fn, calls, contacts, conversations, failNext, accountId, token }
}
