/**
 * Delhivery's label (packing slip) and pickup request calls, kept beside the adapter so it stays
 * one courier per file. Both need the account's token, so they only ever run server-side.
 *
 *   POST /api/p/edit                          cancel
 *   GET  /api/p/packing_slip?wbns=&pdf=true   label PDF link
 *   POST /fm/request/new/                     pickup request
 */

import {
  COURIER_TIMEOUT_MS,
  CourierError,
  courierFetch,
  courierJson,
  type SchedulePickupInput,
  type SchedulePickupResult,
  type ShippingLabelDocument,
} from '@commerce/shipping'

/** How the adapter reaches Delhivery: its id for errors, host, token headers and fetch. */
export type DelhiveryWire = {
  id: string
  baseUrl: string
  headers: (extra?: Record<string, string>) => Record<string, string>
  fetchImpl: typeof fetch
}

/** Delhivery's answer when `pickup_location` names no warehouse on the account. */
export const NO_WAREHOUSE = /ClientWarehouse matching query does not exist/i

/**
 * Packing slip answer. With `pdf=true` each package carries `pdf_download_link`, a short-lived
 * file link that needs no token; an account may send the PDF inline as base64 in `pdf_encoding`
 * instead. The public reference documents only `{ packages: [], packages_found }`, so both are
 * read and anything else is a clear error rather than a guess.
 */
type PackingSlipResponse = {
  packages?: Array<{ wbn?: string; pdf_download_link?: string; pdf_encoding?: string }>
  packages_found?: number
}

type PickupResponse = {
  pickup_id?: number | string
  pr_exist?: boolean
  success?: boolean
  /** The refusal, by field: an unknown warehouse comes back under `pickup_location`. */
  pickup_location?: unknown
  error?: unknown
  detail?: unknown
  message?: unknown
  [field: string]: unknown
}

/** A refusal's words from one answer field: a string, a `{ message }`, or a list of either. */
function wordsOf(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(wordsOf).filter(Boolean).join(' ')
  if (value && typeof value === 'object') {
    const { message, detail, error } = value as Record<string, unknown>
    return wordsOf(message) || wordsOf(detail) || wordsOf(error)
  }
  return ''
}

/** Fields of a success answer, never a refusal's words. */
const ANSWER_FIELDS = new Set(['pickup_id', 'pr_exist', 'success', 'status', 'code'])

/**
 * What Delhivery said, in its own words: the usual message fields first (`error`, `detail`,
 * `message`, which may be `{ message }` objects), else the first field with words (a
 * field-by-field refusal, `{"pickup_time": ["Enter a valid time."]}`, reads
 * "pickup_time: Enter a valid time."), else the start of the raw text.
 */
function delhiverySaid(body: PickupResponse, text: string): string {
  const plain = wordsOf(body.error) || wordsOf(body.detail) || wordsOf(body.message)
  if (plain) return plain
  for (const [field, value] of Object.entries(body)) {
    if (ANSWER_FIELDS.has(field)) continue
    const words = wordsOf(value)
    if (words) return `${field}: ${words}`
  }
  return text.trim().slice(0, 200)
}

/** A 401/403 that is about the token itself, rather than one of the pickup endpoint's refusals. */
const TOKEN_TROUBLE = /token|credential|authenticat|authori[sz]|permission/i

/** Cancel Order API answer (`/api/p/edit`): `{ status, waybill, remark, order_id }`. */
type CancelResponse = { status?: boolean | string; remark?: string; error?: string }

/**
 * Cancel Order API - `POST /api/p/edit`, JSON body `{ waybill, cancellation: "true" }`, answers
 * `{ status: true, waybill, remark: "Shipment has been cancelled", order_id }`
 * (https://delhivery-express-api-doc.readme.io/reference/cancel-order-api). `status: false`
 * is a refusal and its remark says why.
 */
export async function cancelDelhivery(wire: DelhiveryWire, waybill: string): Promise<void> {
  const res = await courierFetch(wire.id, `${wire.baseUrl}/api/p/edit`, {
    method: 'POST',
    headers: wire.headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ waybill, cancellation: 'true' }),
    fetchImpl: wire.fetchImpl,
  })
  const result = await courierJson<CancelResponse>(wire.id, res)
  if (result.status === false || result.status === 'false') {
    throw new CourierError(
      'rejected',
      wire.id,
      `Delhivery did not cancel ${waybill}: ${result.remark || result.error || 'no reason given'}`,
    )
  }
}

/** The first bytes of every PDF. */
const isPdf = (bytes: Uint8Array) =>
  bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46

/**
 * The label PDF: the packing slip with `pdf=true`, then the file it links to (or the inline
 * base64 copy). The file link is opened without the token.
 */
export async function fetchDelhiveryLabel(
  wire: DelhiveryWire,
  waybill: string,
): Promise<ShippingLabelDocument> {
  const res = await courierFetch(
    wire.id,
    `${wire.baseUrl}/api/p/packing_slip?wbns=${encodeURIComponent(waybill)}&pdf=true`,
    { headers: wire.headers(), fetchImpl: wire.fetchImpl },
  )
  // An account that streams the PDF itself.
  if ((res.headers.get('content-type') ?? '').includes('application/pdf')) {
    return { contentType: 'application/pdf', body: new Uint8Array(await res.arrayBuffer()) }
  }
  const slip = await courierJson<PackingSlipResponse>(wire.id, res)
  const pkg = slip.packages?.find((p) => !p.wbn || p.wbn === waybill) ?? slip.packages?.[0]
  if (pkg?.pdf_download_link) {
    const file = await courierFetch(wire.id, pkg.pdf_download_link, { fetchImpl: wire.fetchImpl })
    const body = new Uint8Array(await file.arrayBuffer())
    if (!isPdf(body)) {
      throw new CourierError('bad_response', wire.id, 'Delhivery label link was not a PDF.')
    }
    return { contentType: 'application/pdf', body }
  }
  if (pkg?.pdf_encoding) {
    const body = Uint8Array.from(Buffer.from(pkg.pdf_encoding, 'base64'))
    if (isPdf(body)) return { contentType: 'application/pdf', body }
  }
  throw new CourierError(
    'bad_response',
    wire.id,
    `Delhivery has no label for ${waybill} yet. Try again in a minute, or print it from Delhivery One.`,
  )
}

/** POST the pickup request and read the answer whatever its status (see `requestDelhiveryPickup`). */
async function postPickup(wire: DelhiveryWire, body: unknown) {
  try {
    const res = await wire.fetchImpl(`${wire.baseUrl}/fm/request/new/`, {
      method: 'POST',
      headers: wire.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(COURIER_TIMEOUT_MS),
    })
    return { res, text: await res.text() }
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    throw new CourierError(
      timedOut ? 'timeout' : 'unavailable',
      wire.id,
      timedOut ? 'Delhivery did not answer in time.' : 'Could not reach Delhivery.',
      { cause: error },
    )
  }
}

/**
 * Pickup Request Creation API - `POST /fm/request/new/`, JSON body
 * `{ pickup_location, pickup_time: "hh:mm:ss", pickup_date: "YYYY-MM-DD",
 * expected_package_count }`, answers 201 `{ pickup_id, ... }`
 * (https://delhivery-express-api-doc.readme.io/reference/testpickup-request). Until one is
 * raised for a pickup location, its waybills sit in Delhivery One's "Ready to Ship".
 *
 * Read by hand rather than through `courierFetch`, because Delhivery answers an unknown
 * warehouse with HTTP 401 (`{"pickup_location": "Invalid Pickup Location ClientWarehouse
 * matching query does not exist."}`), which is not a bad token. A request for a location that
 * already has an open one that day (`pr_exist`, or an "already exists" refusal) is the pickup
 * we wanted, so it counts as done.
 */
export async function requestDelhiveryPickup(
  wire: DelhiveryWire,
  input: SchedulePickupInput,
  place: string,
): Promise<SchedulePickupResult> {
  const time = /^\d{1,2}:\d{2}$/.test(input.timeFrom)
    ? `${input.timeFrom.padStart(5, '0')}:00`
    : input.timeFrom
  const { res, text } = await postPickup(wire, {
    pickup_location: place,
    pickup_time: time,
    pickup_date: input.date,
    expected_package_count: input.expectedPackageCount,
  })
  let body: PickupResponse = {}
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      body = parsed as PickupResponse
    }
  } catch {
    // A plain-text refusal; its words are read below.
  }
  if (res.ok && (body.pickup_id || body.pr_exist)) {
    return { providerPickupId: body.pickup_id ? String(body.pickup_id) : 'existing' }
  }
  const said = delhiverySaid(body, text)
  if (NO_WAREHOUSE.test(said) || /invalid pickup location/i.test(said)) {
    throw new CourierError(
      'rejected',
      wire.id,
      `Delhivery has no pickup location named "${place}", so the pickup was not requested. Copy the exact name from Delhivery One → Settings → Pickup locations.`,
      { status: res.status, detail: { code: 'no_pickup_location', pickupLocationName: place } },
    )
  }
  if (body.pr_exist || /already (exists|been|raised|created|scheduled)/i.test(said)) {
    return { providerPickupId: 'existing' }
  }
  /* This endpoint answers its refusals with 401 too (the unknown warehouse above), so a 401 or
     403 is a bad token only when Delhivery says so, or says nothing; otherwise its words are
     the refusal. Either way the merchant reads what Delhivery said. */
  if ((res.status === 401 || res.status === 403) && (!said || TOKEN_TROUBLE.test(said))) {
    throw new CourierError(
      'auth',
      wire.id,
      `Delhivery rejected the API token for the pickup request${said ? `: ${said}` : '.'} Check the token in Apps → Delhivery → Connect.`,
      { status: res.status },
    )
  }
  throw new CourierError(
    'rejected',
    wire.id,
    `Delhivery did not take the pickup request${said ? `: ${said}` : '.'}`,
    { status: res.status },
  )
}
