/**
 * Shadowfax adapter: a last-mile network strong in metros and same-city delivery, on its
 * marketplace (seller pickup) model for forward parcels and its reverse pickup API for
 * returns. Auth is a static per-account key, `Authorization: Token <key>`; no login step.
 *
 * Every wire shape lives in `mapping.ts` with its source and what still needs a live account.
 *
 *   GET  /v1/clients/serviceability/?service=customer_delivery&pincodes=   serviceable PINs
 *   POST /v3/clients/orders/                 forward booking -> AWB (pickup auto-scheduled)
 *   POST /client/generate_label/             4x6 label PDF link (before pickup only)
 *   GET  /v4/clients/orders/{awb}/track/     forward tracking
 *   POST /v3/clients/orders/cancel/          forward cancel (304 = queued at next facility)
 *   POST /v3/clients/order_update/           NDR: reopen_ndr / rto / new delivery details
 *   POST /v3/clients/requests                reverse pickup -> AWB
 *   GET  /v4/clients/requests/{awb}          reverse tracking
 *   POST /v2/clients/requests/mark_cancel    reverse cancel
 *   Push callback                            status per AWB; authenticated by its header key
 *
 * NOT IMPLEMENTED: rates and transit days (no such lookup on the client API), wallet.
 */

import { logger } from '@commerce/observability/logging'
import {
  COURIER_TIMEOUT_MS,
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  courierBaseUrlProblem,
  courierFetch,
  courierJson,
  isValidPincode,
  type NdrActionInput,
  type NdrActionResult,
  type ProviderField,
  type ReturnPickupInput,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
  timingSafeEqualString,
  type WebhookNotice,
  type WebhookRequest,
} from '@commerce/shipping'
import { SHADOWFAX_CAPABILITIES } from './client'
import {
  type CancelResponse,
  describeErrors,
  type ForwardCreateResponse,
  type ForwardTrackResponse,
  forwardBody,
  isReverseAwb,
  type LabelResponse,
  mapShadowfaxStatus,
  ndrBody,
  type ReverseCreateResponse,
  type ReverseTrackResponse,
  reverseBody,
  type ServiceabilityRow,
  SHADOWFAX_BASE_URL,
  scanDescription,
  shadowfaxTime,
  type UpdateResponse,
} from './mapping'

export { SHADOWFAX_BASE_URL }

export type ShadowfaxConfig = {
  /** The API key from Shadowfax's onboarding email (staging and production keys differ). */
  apiToken: string
  originPincode: string
  /** Sent on reverse pickups' GST block; blank for a seller without GST registration. */
  sellerGstin?: string | undefined
  /** `https://dale.staging.shadowfax.in/api` for staging keys; blank for production. */
  baseUrl?: string | undefined
  /** The key set on the Shadowfax client portal's Webhook tab; the push carries it in its
   *  `Authorization` header. Required: without it every push is refused. */
  webhookSecret?: string | undefined
  fetchImpl?: typeof fetch | undefined
}

/** Statuses Shadowfax answers with a JSON body that says what went wrong (a refused booking
 *  is a 400 with `errors`; a cancel in motion is a 304). `courierFetch` turns any non-2xx into
 *  a bare HTTP error, so these reach the adapter as 200 with the original status attached. */
const READABLE = new Set([304, 400, 404])
const ORIGINAL_STATUS = 'x-shadowfax-status'

function readableErrors(fetchImpl: typeof fetch): typeof fetch {
  return async (input, init) => {
    const res = await fetchImpl(input, init)
    if (!READABLE.has(res.status)) return res
    const text = res.status === 304 ? '{}' : await res.text()
    return new Response(text, { status: 200, headers: { [ORIGINAL_STATUS]: String(res.status) } })
  }
}

export class ShadowfaxProvider implements ShippingProvider {
  readonly id = 'shadowfax'
  readonly label = 'Shadowfax'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly config: ShadowfaxConfig) {
    this.baseUrl = (config.baseUrl || SHADOWFAX_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = readableErrors(config.fetchImpl ?? fetch)
  }

  /** The parsed body and the status Shadowfax actually answered with. */
  private async call<T>(path: string, body?: unknown): Promise<{ data: T; status: number }> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Token ${this.config.apiToken}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      fetchImpl: this.fetchImpl,
      timeoutMs: COURIER_TIMEOUT_MS,
    })
    const status = Number(res.headers.get(ORIGINAL_STATUS) ?? res.status)
    const text = await res.text()
    const data = text.trim() ? await courierJson<T>(this.id, new Response(text)) : ({} as T)
    return { data, status }
  }

  private async serviceable(service: string, pincode: string): Promise<boolean> {
    const qs = new URLSearchParams({ service, page: '1', count: '10', pincodes: pincode })
    const { data, status } = await this.call<ServiceabilityRow[]>(
      `/v1/clients/serviceability/?${qs}`,
    )
    if (status !== 200 || !Array.isArray(data)) return false
    // Only serviceable PINs come back; absence is the "no".
    return data.some((row) => String(row.code) === pincode)
  }

  /** Shadowfax gives no transit days and no COD flag per PIN on this API; a PIN it delivers
   *  to takes COD on its network (VERIFY per account: COD is an account setting). */
  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const ok = await this.serviceable('customer_delivery', query.destinationPincode)
    return {
      provider: this.id,
      serviceable: ok,
      codAvailable: ok,
      prepaidAvailable: ok,
      minTransitDays: null,
      maxTransitDays: null,
      reason: ok ? null : 'Shadowfax does not deliver to this PIN code.',
    }
  }

  private async labelUrl(awb: string): Promise<string | undefined> {
    const { data } = await this.call<LabelResponse>('/client/generate_label/', {
      awb_number: awb,
      file_type: 'pdf',
    })
    return data.data?.label_url
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const { data } = await this.call<ForwardCreateResponse>(
      '/v3/clients/orders/',
      forwardBody(input),
    )
    // A refusal can be HTTP 200 with `message: "Failure"`: the AWB is the only proof of a booking.
    const awb = data.data?.awb_number
    if (!awb) {
      throw new CourierError(
        'rejected',
        this.id,
        `Shadowfax rejected the order: ${describeErrors(data.errors, data.message)}`,
      )
    }
    // The label link is generated asynchronously and only before pickup; best-effort.
    const labelUrl = await this.labelUrl(awb).catch(() => undefined)
    return { waybill: awb, providerRef: data.data?.client_order_id || awb, labelUrl }
  }

  async createReturnPickup(input: ReturnPickupInput): Promise<CreateShipmentResult> {
    const { data } = await this.call<ReverseCreateResponse>(
      '/v3/clients/requests',
      reverseBody(input, this.config.sellerGstin ?? ''),
    )
    const awb = data.client_request_id
    if (!awb || data.message === 'Failure') {
      throw new CourierError(
        'rejected',
        this.id,
        `Shadowfax rejected the return pickup: ${describeErrors(data.errors, data.message)}`,
      )
    }
    return { waybill: awb, providerRef: data.client_order_number || awb }
  }

  private async trackForward(awb: string): Promise<Tracking | null> {
    const { data, status } = await this.call<ForwardTrackResponse>(
      `/v4/clients/orders/${encodeURIComponent(awb)}/track/`,
    )
    const order = data.order_details
    if (status !== 200 || !order) return null
    const events: TrackingEvent[] = (data.tracking_details ?? []).map((e) => ({
      at: shadowfaxTime(e.created),
      status: mapShadowfaxStatus(e.status_id || e.status),
      description: scanDescription(e.status_id || e.status, e.remarks),
      location: e.location || undefined,
    }))
    events.sort((a, b) => a.at.localeCompare(b.at))
    return {
      waybill: awb,
      status: mapShadowfaxStatus(order.status_id || order.status),
      events,
      trackingUrl: order.customer_track_url || undefined,
      expectedDate: order.promised_delivery_date?.slice(0, 10) || undefined,
    }
  }

  private async trackReverse(awb: string): Promise<Tracking | null> {
    const { data, status } = await this.call<ReverseTrackResponse>(
      `/v4/clients/requests/${encodeURIComponent(awb)}`,
    )
    if (status !== 200 || !data.status) return null
    const events: TrackingEvent[] = (data.pickup_request_state_histories ?? []).map((h) => ({
      at: shadowfaxTime(h.created_at, false),
      status: mapShadowfaxStatus(h.state),
      description: h.comment || h.state || '',
      location: h.current_location || undefined,
    }))
    events.sort((a, b) => a.at.localeCompare(b.at))
    return { waybill: awb, status: mapShadowfaxStatus(data.status), events }
  }

  /** Forward and reverse AWBs live on different endpoints; the AWB's shape picks the first
   *  one to ask and the other is the fallback. */
  async track(waybill: string): Promise<Tracking> {
    const order = isReverseAwb(waybill)
      ? [() => this.trackReverse(waybill), () => this.trackForward(waybill)]
      : [() => this.trackForward(waybill), () => this.trackReverse(waybill)]
    for (const attempt of order) {
      const found = await attempt()
      if (found) return found
    }
    throw new CourierError('bad_response', this.id, 'Shadowfax has no record of this AWB.')
  }

  private async cancelAt(path: string, awb: string): Promise<CancelResponse & { http: number }> {
    const { data, status } = await this.call<CancelResponse>(path, {
      request_id: awb,
      cancel_remarks: 'Cancelled by Client',
    })
    return { ...data, http: status }
  }

  /** 200 "marked as cancelled", or 304 queued (the parcel is moving; Shadowfax cancels it at
   *  the next facility). The body's own `responseCode` 400 is a refusal despite HTTP 200. */
  async cancel(waybill: string): Promise<void> {
    const paths = isReverseAwb(waybill)
      ? ['/v2/clients/requests/mark_cancel', '/v3/clients/orders/cancel/']
      : ['/v3/clients/orders/cancel/', '/v2/clients/requests/mark_cancel']
    let last: (CancelResponse & { http: number }) | undefined
    for (const path of paths) {
      last = await this.cancelAt(path, waybill)
      if (last.http === 304) return
      if (last.http === 200 && (last.responseCode ?? 200) === 200) return
      if (last.http !== 404) break
    }
    throw new CourierError(
      'rejected',
      this.id,
      `Shadowfax did not cancel the order: ${last?.responseMsg || last?.message || 'no detail returned'}`,
    )
  }

  async ndrAction(input: NdrActionInput): Promise<NdrActionResult> {
    const { data, status } = await this.call<UpdateResponse>(
      '/v3/clients/order_update/',
      ndrBody(input),
    )
    if (status !== 200 || data.message === 'Failure' || (data.responseCode ?? 200) >= 400) {
      throw new CourierError(
        'rejected',
        this.id,
        `Shadowfax rejected the NDR action: ${describeErrors(data.errors, data.message)}`,
      )
    }
    return { accepted: true }
  }

  /**
   * The push callback carries the key set on the client portal's Webhook tab in its
   * `Authorization` header (with or without the "Token " prefix). Fails closed without a
   * configured secret.
   */
  async parseWebhook(request: WebhookRequest): Promise<WebhookNotice[]> {
    const secret = this.config.webhookSecret
    if (!secret) {
      logger.error('webhook refused: no webhookSecret configured', { provider: this.id })
      throw new CourierError('auth', this.id, 'Shadowfax webhook secret is not configured.')
    }
    const got = (request.headers.authorization ?? '').replace(/^Token\s+/i, '').trim()
    if (!got || !timingSafeEqualString(got, secret)) {
      throw new CourierError('auth', this.id, 'Shadowfax webhook key did not match.')
    }
    let body: unknown
    try {
      body = JSON.parse(request.rawBody)
    } catch (error) {
      throw new CourierError('bad_response', this.id, 'Shadowfax webhook body was not JSON.', {
        cause: error,
      })
    }
    const items = Array.isArray(body) ? body : [body]
    return items.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const r = item as Record<string, unknown>
      const awb = r.awb_number
      if (typeof awb !== 'string' || !awb) return []
      const event = r.event ?? r.status ?? ''
      return [
        { waybill: awb, eventId: `${awb}:${String(event)}:${String(r.event_timestamp ?? '')}` },
      ]
    })
  }

  /** A serviceability lookup is the cheapest authenticated call; a wrong key is a 401. */
  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.call<ServiceabilityRow[]>(
        `/v1/clients/serviceability/?service=customer_delivery&page=1&count=1&pincodes=${this.config.originPincode}`,
      )
      return { ok: true, message: `Connected to Shadowfax at ${this.baseUrl}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'Shadowfax rejected the API key. Check it is the key for this environment (staging and production keys differ).',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify Shadowfax credentials.',
      }
    }
  }
}

const fields: ProviderField[] = [
  {
    key: 'apiToken',
    label: 'API key',
    secret: true,
    required: true,
    help: 'From the email Shadowfax sends when your account is activated.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  {
    key: 'sellerGstin',
    label: 'Seller GSTIN',
    help: 'Used on return pickups. Leave blank if not registered.',
  },
  {
    key: 'baseUrl',
    label: 'API base URL',
    help: 'Leave blank for production. Staging keys: https://dale.staging.shadowfax.in/api',
  },
  {
    key: 'webhookSecret',
    label: 'Webhook key',
    secret: true,
    help: 'Required for automatic tracking updates. Use the same value as the Authorization key on the Shadowfax portal Webhook tab.',
  },
]

export const shadowfaxFactory: ShippingProviderFactory<ShadowfaxConfig> = {
  id: 'shadowfax',
  label: 'Shadowfax',
  fields,
  capabilities: SHADOWFAX_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.apiToken?.trim()) errors.push('API key is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    const gstin = r.sellerGstin?.trim().toUpperCase()
    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) errors.push('GSTIN must be 15 characters')
    const baseUrlProblem = courierBaseUrlProblem(r.baseUrl, ['shadowfax.in'])
    if (baseUrlProblem) errors.push(baseUrlProblem)
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        apiToken: (r.apiToken as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        sellerGstin: gstin || undefined,
        baseUrl: r.baseUrl?.trim() || undefined,
        webhookSecret: r.webhookSecret?.trim() || undefined,
      },
    }
  },
  create: (config) => new ShadowfaxProvider(config),
}
