import { CommerceError } from '@commerce/core'
import { type LookupAll, readCapped, safeFetch } from '@commerce/core/safe-fetch'

/**
 * A small client for Chatwoot's Application API (https://developers.chatwoot.com/api-reference),
 * server side only: it carries an agent's API access token (`api_access_token` header). Only
 * the calls this app needs: the profile and inboxes (test connection), contact search, create
 * and update (sync), and a contact's conversations (the admin cards).
 *
 * The address is the merchant's, so every call goes through `safeFetch` (public https hosts
 * only, headers never follow a redirect elsewhere) unless the platform listed its origin in
 * `CHATWOOT_TRUSTED_ORIGINS` (a Chatwoot on the private network).
 */

export type ChatwootErrorCode =
  | 'unauthorized'
  | 'not-found'
  | 'invalid'
  | 'rate-limited'
  | 'unreachable'
  | 'bad-response'

const MESSAGES: Record<ChatwootErrorCode, string> = {
  unauthorized:
    'Chatwoot did not accept the API access token, or it cannot open this account. Copy the token from your Chatwoot profile settings again.',
  'not-found': 'Chatwoot has no account with that id at this address. Check the account id.',
  invalid: 'Chatwoot refused the details we sent.',
  'rate-limited': 'Chatwoot is busy (too many requests). We will try again shortly.',
  unreachable:
    'Could not reach Chatwoot at that address. Check the address and that Chatwoot is running.',
  'bad-response':
    'Chatwoot sent an answer we could not read. Check the address points at Chatwoot.',
}

export class ChatwootError extends CommerceError {
  override readonly code: ChatwootErrorCode
  /** Seconds Chatwoot asked us to wait, on `rate-limited`. */
  readonly retryAfter: number | null

  constructor(code: ChatwootErrorCode, detail?: string | null, retryAfter: number | null = null) {
    super(code, detail ? `${MESSAGES[code]} ${detail}` : MESSAGES[code])
    this.code = code
    this.retryAfter = retryAfter
  }
}

export type ChatwootClientOptions = {
  /** The normalised Chatwoot address (`normaliseChatwootUrl`). */
  baseUrl: string
  accountId: string
  apiToken: string
  /** Origins reached with a plain fetch: private network or http allowed. */
  trustedOrigins?: readonly string[] | undefined
  /** Injected in tests. */
  fetch?: typeof fetch | undefined
  /** Injected in tests. */
  lookup?: LookupAll | undefined
  timeoutMs?: number | undefined
}

export type ChatwootContact = {
  id: number
  name: string | null
  email: string | null
  phone: string | null
  identifier: string | null
  customAttributes: Record<string, unknown>
}

/** What we write on a contact. Only the fields that are set are sent. */
export type ChatwootContactInput = {
  name?: string | undefined
  email?: string | undefined
  phone_number?: string | undefined
  identifier: string
  custom_attributes: Record<string, string | number>
}

export type ChatwootConversation = {
  id: number
  status: 'open' | 'pending' | 'snoozed' | 'resolved'
  inboxId: number | null
  unreadCount: number
  lastActivityAt: Date | null
  /** The last message's text, trimmed. */
  preview: string | null
}

export type ChatwootInbox = {
  id: number
  name: string
  channelType: string
  websiteToken: string | null
}

/** The most an answer may weigh; a page of conversations is a few hundred kilobytes at most. */
const MAX_BYTES = 4_000_000

/** `CHATWOOT_TRUSTED_ORIGINS` (comma-separated) as a clean list of origins. */
export function parseTrustedOrigins(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => {
      try {
        return new URL(s.trim()).origin
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

const int = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isInteger(n) ? n : null
}

/** Chatwoot wraps most answers in `payload`, some twice (`payload.contact`). */
const unwrap = (raw: unknown): unknown => (isRecord(raw) && 'payload' in raw ? raw.payload : raw)

export function toContact(raw: unknown): ChatwootContact | null {
  const body = isRecord(raw) && isRecord(raw.contact) ? raw.contact : raw
  if (!isRecord(body)) return null
  const id = int(body.id)
  if (id === null) return null
  return {
    id,
    name: str(body.name),
    email: str(body.email),
    phone: str(body.phone_number),
    identifier: str(body.identifier),
    customAttributes: isRecord(body.custom_attributes) ? body.custom_attributes : {},
  }
}

const STATUSES = new Set(['open', 'pending', 'snoozed', 'resolved'])

/** Unix seconds (Chatwoot's usual) or an ISO string, as a date. */
function toDate(v: unknown): Date | null {
  if (typeof v === 'number' && v > 0) return new Date(v < 1e12 ? v * 1000 : v)
  if (typeof v === 'string' && v) {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function toConversation(raw: unknown): ChatwootConversation | null {
  if (!isRecord(raw)) return null
  const id = int(raw.id) ?? int(raw.display_id)
  if (id === null) return null
  const messages = Array.isArray(raw.messages) ? raw.messages : []
  const last = [...messages].reverse().find((m) => isRecord(m) && str(m.content))
  const text = isRecord(last) ? str(last.content) : null
  return {
    // The dashboard links by `display_id` (per account), which is what `id` is in this API.
    id: int(raw.display_id) ?? id,
    status: (STATUSES.has(String(raw.status))
      ? raw.status
      : 'open') as ChatwootConversation['status'],
    inboxId: int(raw.inbox_id),
    unreadCount: int(raw.unread_count) ?? 0,
    lastActivityAt: toDate(raw.last_activity_at) ?? toDate(raw.timestamp) ?? toDate(raw.created_at),
    preview: text ? (text.length > 140 ? `${text.slice(0, 139)}…` : text) : null,
  }
}

export function chatwootClient(opts: ChatwootClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, '')
  const trusted = (opts.trustedOrigins ?? []).includes(new URL(base).origin)
  const doFetch = opts.fetch ?? fetch
  const timeoutMs = opts.timeoutMs ?? 15_000
  const account = `/api/v1/accounts/${encodeURIComponent(opts.accountId)}`

  async function send(
    path: string,
    init: {
      method?: 'GET' | 'POST' | 'PUT'
      query?: Record<string, string | number>
      body?: unknown
    } = {},
  ): Promise<unknown> {
    const url = new URL(`${base}${path}`)
    for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, String(v))
    const headers: Record<string, string> = {
      accept: 'application/json',
      api_access_token: opts.apiToken,
    }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    const body = init.body === undefined ? undefined : JSON.stringify(init.body)
    const method = init.method ?? 'GET'
    let res: Response
    try {
      res = trusted
        ? await doFetch(url.href, {
            method,
            headers,
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
            ...(body === undefined ? {} : { body }),
          })
        : await safeFetch(url.href, {
            method,
            headers,
            body,
            fetch: doFetch,
            ...(opts.lookup ? { lookup: opts.lookup } : {}),
            timeoutMs,
          })
    } catch {
      throw new ChatwootError('unreachable')
    }
    if (res.status === 401 || res.status === 403) throw new ChatwootError('unauthorized')
    if (res.status === 404) throw new ChatwootError('not-found')
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after'))
      throw new ChatwootError('rate-limited', null, Number.isFinite(wait) && wait > 0 ? wait : null)
    }
    const bytes = res.status === 204 ? new Uint8Array() : await readCapped(res, MAX_BYTES)
    if (!bytes) throw new ChatwootError('bad-response')
    let parsed: unknown = null
    if (bytes.length > 0) {
      try {
        parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown
      } catch {
        throw new ChatwootError(res.ok ? 'bad-response' : 'unreachable')
      }
    }
    if (res.status === 422 || res.status === 400) {
      throw new ChatwootError('invalid', isRecord(parsed) ? str(parsed.message) : null)
    }
    if (!res.ok) throw new ChatwootError(res.status >= 500 ? 'unreachable' : 'bad-response')
    return parsed
  }

  return {
    /** The token's owner and the accounts it can open; proves the address and the token. */
    async profile(): Promise<{ name: string; accountIds: string[] }> {
      const raw = await send('/api/v1/profile')
      if (!isRecord(raw)) throw new ChatwootError('bad-response')
      const accounts = Array.isArray(raw.accounts) ? raw.accounts : []
      return {
        name: str(raw.name) ?? str(raw.email) ?? '',
        accountIds: accounts.flatMap((a) =>
          isRecord(a) && int(a.id) !== null ? [String(a.id)] : [],
        ),
      }
    },

    /** The account's inboxes; the website ones carry their widget token. */
    async inboxes(): Promise<ChatwootInbox[]> {
      const list = unwrap(await send(`${account}/inboxes`))
      if (!Array.isArray(list)) throw new ChatwootError('bad-response')
      return list.flatMap((raw) => {
        if (!isRecord(raw)) return []
        const id = int(raw.id)
        if (id === null) return []
        return [
          {
            id,
            name: str(raw.name) ?? '',
            channelType: str(raw.channel_type) ?? '',
            websiteToken: str(raw.website_token),
          },
        ]
      })
    },

    /** Contacts whose name, email, phone or identifier match `q` (Chatwoot's own search). */
    async searchContacts(q: string): Promise<ChatwootContact[]> {
      const list = unwrap(await send(`${account}/contacts/search`, { query: { q, page: 1 } }))
      if (!Array.isArray(list)) throw new ChatwootError('bad-response')
      return list.map(toContact).filter((c): c is ChatwootContact => c !== null)
    },

    async createContact(
      input: ChatwootContactInput & { inbox_id?: number | undefined },
    ): Promise<ChatwootContact> {
      const contact = toContact(
        unwrap(await send(`${account}/contacts`, { method: 'POST', body: input })),
      )
      if (!contact) throw new ChatwootError('bad-response')
      return contact
    },

    async updateContact(
      id: number,
      input: Partial<ChatwootContactInput>,
    ): Promise<ChatwootContact> {
      const contact = toContact(
        unwrap(await send(`${account}/contacts/${id}`, { method: 'PUT', body: input })),
      )
      if (!contact) throw new ChatwootError('bad-response')
      return contact
    },

    /** A contact's conversations, newest activity first. */
    async contactConversations(id: number): Promise<ChatwootConversation[]> {
      const list = unwrap(await send(`${account}/contacts/${id}/conversations`))
      if (!Array.isArray(list)) throw new ChatwootError('bad-response')
      return list
        .map(toConversation)
        .filter((c): c is ChatwootConversation => c !== null)
        .sort((a, b) => (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0))
    },
  }
}

export type ChatwootClient = ReturnType<typeof chatwootClient>
