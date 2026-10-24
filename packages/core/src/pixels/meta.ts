/** SOURCE OF TRUTH: Meta Conversions API client — WHAT: builds a server event, POSTs it to `/<pixel>/events`, checks a pasted token and sorts Meta's errors into retry / auth / fail / WHY: one place that talks to graph.facebook.com for pixels, so the token handling and error rules cannot drift */
import type { PixelEventName, PixelMatched } from '@commerce/db'
import { META_GRAPH_VERSION } from '../sales-channels/providers'
import type { HashedUserData } from './hash'

/*
 * One event per call in v1 (Meta takes up to 1000). The token goes in the request body, never
 * the URL, and is scrubbed from any message we keep. Design §5. Tests pass a fake `fetch`;
 * nothing here runs against the real Graph API outside a worker or `sendTest`.
 */

export const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`

const MAX_ERROR = 500

export type MetaContent = { id: string; quantity: number; itemPricePaise: number }

export type MetaEventInput = {
  name: PixelEventName
  eventId: string
  /** When it happened: for Purchase, when the order was placed. */
  at: Date
  url?: string | null | undefined
  user: HashedUserData
  ip?: string | null | undefined
  ua?: string | null | undefined
  fbp?: string | null | undefined
  fbc?: string | null | undefined
  valuePaise?: number | null | undefined
  contents?: MetaContent[] | undefined
  /** The order number shown to the merchant (`1042`). */
  orderNumber?: string | number | null | undefined
}

export type MetaServerEvent = {
  event_name: PixelEventName
  event_time: number
  event_id: string
  action_source: 'website'
  event_source_url?: string
  user_data: HashedUserData & {
    client_ip_address?: string
    client_user_agent?: string
    fbp?: string
    fbc?: string
  }
  custom_data?: {
    currency: 'INR'
    value?: number
    content_ids?: string[]
    contents?: { id: string; quantity: number; item_price: number }[]
    content_type?: 'product'
    num_items?: number
    order_id?: string
  }
}

const rupees = (paise: number) => Math.round(paise) / 100

/** The Conversions API event for one of our events. Values are in rupees, as Meta expects. */
export function buildMetaEvent(e: MetaEventInput): MetaServerEvent {
  const user: MetaServerEvent['user_data'] = { ...e.user }
  if (e.ip) user.client_ip_address = e.ip
  if (e.ua) user.client_user_agent = e.ua
  if (e.fbp) user.fbp = e.fbp
  if (e.fbc) user.fbc = e.fbc
  const event: MetaServerEvent = {
    event_name: e.name,
    event_time: Math.floor(e.at.getTime() / 1000),
    event_id: e.eventId,
    action_source: 'website',
    user_data: user,
  }
  if (e.url) event.event_source_url = e.url
  const hasValue = typeof e.valuePaise === 'number'
  const contents = e.contents ?? []
  if (hasValue || contents.length > 0 || e.orderNumber != null) {
    const custom: NonNullable<MetaServerEvent['custom_data']> = { currency: 'INR' }
    if (hasValue) custom.value = rupees(e.valuePaise as number)
    if (contents.length > 0) {
      custom.content_ids = contents.map((c) => c.id)
      custom.contents = contents.map((c) => ({
        id: c.id,
        quantity: c.quantity,
        item_price: rupees(c.itemPricePaise),
      }))
      custom.content_type = 'product'
      custom.num_items = contents.reduce((n, c) => n + c.quantity, 0)
    }
    if (e.orderNumber != null) custom.order_id = String(e.orderNumber)
    event.custom_data = custom
  }
  return event
}

/** Which customer details an event carried, for the log. Booleans only, never the values. */
export function matchedOf(event: MetaServerEvent): PixelMatched {
  const u = event.user_data
  return {
    em: Boolean(u.em),
    ph: Boolean(u.ph),
    fn: Boolean(u.fn),
    ln: Boolean(u.ln),
    ct: Boolean(u.ct),
    st: Boolean(u.st),
    zp: Boolean(u.zp),
    external_id: Boolean(u.external_id),
    fbp: Boolean(u.fbp),
    fbc: Boolean(u.fbc),
    ip: Boolean(u.client_ip_address),
    ua: Boolean(u.client_user_agent),
  }
}

// Errors.

export type MetaErrorKind = 'retry' | 'auth' | 'fail'

/** Meta's throttling and temporary codes: try again later. */
const RETRY_CODES = new Set([1, 2, 4, 17, 32, 341, 613])
/** The token is expired, revoked or lacks access: stop and ask the merchant for a new one. */
const AUTH_CODES = new Set([102, 190])

export function classifyMetaError(status: number, code: number | null | undefined): MetaErrorKind {
  if (code != null && AUTH_CODES.has(code)) return 'auth'
  if (status === 401) return 'auth'
  if (code != null && RETRY_CODES.has(code)) return 'retry'
  if (status === 429 || status >= 500 || status === 0) return 'retry'
  return 'fail'
}

/** Meta's message, cut to what the log keeps, with the token removed if Meta echoed it. */
export function cleanMetaMessage(message: string, token?: string | null): string {
  let m = message
  if (token) m = m.split(token).join('[token]')
  m = m.replace(/access_token=[^&\s]+/g, 'access_token=[token]')
  return m.length > MAX_ERROR ? `${m.slice(0, MAX_ERROR - 1)}…` : m
}

// Client.

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export type MetaSendResult =
  | { ok: true; status: number; fbtraceId: string | null; eventsReceived: number }
  | {
      ok: false
      status: number
      kind: MetaErrorKind
      code: number | null
      message: string
      fbtraceId: string | null
    }

type GraphError = {
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string }
  fbtrace_id?: string
  events_received?: number
  id?: string
  name?: string
}

async function readJson(res: Response): Promise<GraphError> {
  try {
    return ((await res.json()) as GraphError | null) ?? {}
  } catch {
    return {}
  }
}

async function call(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; body: GraphError } | { status: 0; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal })
    return { status: res.status, body: await readJson(res) }
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError'
    return { status: 0, error: aborted ? 'Meta did not answer in time' : 'Could not reach Meta' }
  } finally {
    clearTimeout(timer)
  }
}

function failure(
  status: number,
  body: GraphError,
  token: string,
): Extract<MetaSendResult, { ok: false }> {
  const code = body.error?.code ?? null
  return {
    ok: false,
    status,
    kind: classifyMetaError(status, code),
    code,
    message: cleanMetaMessage(body.error?.message ?? `Meta answered ${status}`, token),
    fbtraceId: body.error?.fbtrace_id ?? body.fbtrace_id ?? null,
  }
}

export type SendMetaEventsInput = {
  pixelId: string
  token: string
  events: MetaServerEvent[]
  testEventCode?: string | null | undefined
  fetch?: FetchLike | undefined
  timeoutMs?: number | undefined
}

/** POST events to `/<pixelId>/events`. Never throws: network trouble comes back as `retry`. */
export async function sendMetaEvents(input: SendMetaEventsInput): Promise<MetaSendResult> {
  const fetchImpl = input.fetch ?? fetch
  const body: Record<string, unknown> = { data: input.events, access_token: input.token }
  if (input.testEventCode) body.test_event_code = input.testEventCode
  const res = await call(
    fetchImpl,
    `${META_GRAPH}/${encodeURIComponent(input.pixelId)}/events`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    input.timeoutMs ?? 15_000,
  )
  if ('error' in res) {
    return { ok: false, status: 0, kind: 'retry', code: null, message: res.error, fbtraceId: null }
  }
  if (res.status >= 200 && res.status < 300 && !res.body.error) {
    return {
      ok: true,
      status: res.status,
      fbtraceId: res.body.fbtrace_id ?? null,
      eventsReceived: res.body.events_received ?? 0,
    }
  }
  return failure(res.status, res.body, input.token)
}

export type VerifyMetaTokenResult =
  | { ok: true; name: string | null }
  | Extract<MetaSendResult, { ok: false }>

/** Check a pasted token can see the pixel: `GET /<pixelId>?fields=id,name`. */
export async function verifyMetaToken(input: {
  pixelId: string
  token: string
  fetch?: FetchLike | undefined
  timeoutMs?: number | undefined
}): Promise<VerifyMetaTokenResult> {
  const fetchImpl = input.fetch ?? fetch
  const res = await call(
    fetchImpl,
    `${META_GRAPH}/${encodeURIComponent(input.pixelId)}?fields=id,name`,
    { method: 'GET', headers: { authorization: `Bearer ${input.token}` } },
    input.timeoutMs ?? 10_000,
  )
  if ('error' in res) {
    return { ok: false, status: 0, kind: 'retry', code: null, message: res.error, fbtraceId: null }
  }
  if (res.status >= 200 && res.status < 300 && !res.body.error) {
    return { ok: true, name: res.body.name ?? null }
  }
  return failure(res.status, res.body, input.token)
}
