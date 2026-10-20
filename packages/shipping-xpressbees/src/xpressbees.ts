/**
 * Xpressbees adapter: a direct courier with its own network (Surface, Air and same-day
 * services), booked through the seller dashboard's API. Login is email + password, answered
 * with a bearer token; `LoginTokenCache` keeps it in memory and logs in again on a 401.
 *
 * Every wire shape lives in `mapping.ts` with its source and what still needs a live account.
 *
 *   POST /users/login                  {email,password} -> { status, data: token }
 *   POST /courier/serviceability       price per service on a route (prepaid or COD)
 *   POST /shipments2                   book + AWB + label URL; pickup auto-requested
 *   GET  /shipments2/track/{awb}       scan history
 *   POST /shipments2/cancel            {awb}
 *   POST /shipments2/manifest          {awbs} -> manifest PDF URL
 *   POST /ndr/create                   re-attempt / change address / change phone
 *
 * NOT IMPLEMENTED: reverse pickup (Xpressbees books returns on a separate account product;
 * not confirmed on this API), wallet balance (no endpoint seen), transit days (the
 * serviceability answer carries none, so checkout falls back to the merchant's own days).
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
  firstHeader,
  hmacSha256Matches,
  isValidPincode,
  LoginTokenCache,
  type NdrActionInput,
  type NdrActionResult,
  type ProviderField,
  type RateOption,
  type RateQuery,
  type RateQuote,
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
import { XPRESSBEES_CAPABILITIES } from './client'
import {
  type LoginResponse,
  mapXpressbeesStatus,
  ndrBody,
  rupeesToPaise,
  type ServiceabilityResponse,
  type ServiceRate,
  type ShipmentResponse,
  type SimpleResponse,
  scanDescription,
  serviceabilityBody,
  shipmentBody,
  type TrackResponse,
  XPRESSBEES_BASE_URL,
  XPRESSBEES_SIGNATURE_HEADERS,
  xpressbeesCharges,
  xpressbeesTime,
} from './mapping'

export { XPRESSBEES_BASE_URL }

/** Xpressbees does not state a token lifetime; a few hours is well inside what it honours,
 *  and a 401 earlier than that triggers one fresh login anyway. */
const TOKEN_LIFETIME_MS = 6 * 60 * 60 * 1000

export type XpressbeesConfig = {
  /** The Xpressbees dashboard login used for the API (Settings > API on shipment.xpressbees.com). */
  email: string
  password: string
  /** Pickup warehouse name, exactly as registered on the Xpressbees dashboard. */
  warehouseName: string
  originPincode: string
  baseUrl?: string | undefined
  /** Signs the tracking webhook (HMAC-SHA256 of the body). Required: without it every
   *  webhook call is refused rather than accepted unauthenticated. */
  webhookSecret?: string | undefined
  fetchImpl?: typeof fetch | undefined
}

const total = (r: ServiceRate) => Number(r.total_charges)

export class XpressbeesProvider implements ShippingProvider {
  readonly id = 'xpressbees'
  readonly label = 'Xpressbees'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly tokens: LoginTokenCache

  constructor(private readonly config: XpressbeesConfig) {
    this.baseUrl = (config.baseUrl || XPRESSBEES_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
    this.tokens = new LoginTokenCache(() => this.login())
  }

  private async login(): Promise<{ token: string; lifetimeMs: number }> {
    const res = await courierFetch(this.id, `${this.baseUrl}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
      fetchImpl: this.fetchImpl,
      timeoutMs: COURIER_TIMEOUT_MS,
    })
    const body = await courierJson<LoginResponse>(this.id, res)
    if (!body.status || typeof body.data !== 'string' || !body.data) {
      throw new CourierError('auth', this.id, body.message || 'Xpressbees did not return a token.')
    }
    return { token: body.data, lifetimeMs: TOKEN_LIFETIME_MS }
  }

  private request<T>(path: string, body?: unknown): Promise<T> {
    return this.tokens.withToken(async (token) => {
      const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        fetchImpl: this.fetchImpl,
        timeoutMs: COURIER_TIMEOUT_MS,
      })
      return courierJson<T>(this.id, res)
    })
  }

  /** Every service Xpressbees prices on the route; empty means not serviceable. */
  private async rates(query: {
    originPincode: string
    destinationPincode: string
    weightGrams?: number | null | undefined
    orderValueRupees?: number | null | undefined
    cod: boolean
  }): Promise<ServiceRate[]> {
    const data = await this.request<ServiceabilityResponse>(
      '/courier/serviceability',
      serviceabilityBody({
        originPincode: query.originPincode,
        destinationPincode: query.destinationPincode,
        weightGrams: query.weightGrams ?? 500,
        orderValueRupees: query.orderValueRupees ?? 0,
        cod: query.cod,
      }),
    )
    // A route nobody serves comes back as `status: false` with a message, not an error.
    if (!data.status || !Array.isArray(data.data)) return []
    return data.data.filter((r) => r.id != null && Number.isFinite(total(r)) && total(r) > 0)
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const base = {
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      orderValueRupees: query.declaredValue,
    }
    const [prepaid, cod] = await Promise.all([
      this.rates({ ...base, cod: false }),
      this.rates({ ...base, cod: true }),
    ])
    const serviceable = prepaid.length > 0 || cod.length > 0
    return {
      provider: this.id,
      serviceable,
      codAvailable: cod.length > 0,
      prepaidAvailable: prepaid.length > 0,
      minTransitDays: null,
      maxTransitDays: null,
      reason: serviceable ? null : 'Xpressbees does not service this route.',
    }
  }

  async quoteRate(query: RateQuery): Promise<RateQuote | null> {
    const options = await this.quoteOptions(query)
    if (options.length === 0) return null
    const cheapest = options.reduce((min, o) => (o.pricePaise < min.pricePaise ? o : min))
    return { pricePaise: cheapest.pricePaise, minTransitDays: null, maxTransitDays: null }
  }

  /** One row per Xpressbees service (Surface 0.5kg, Air, ...), bookable by its courier id. */
  async quoteOptions(query: RateQuery): Promise<RateOption[]> {
    const cod = query.paymentMode === 'cod'
    const rows = await this.rates({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      orderValueRupees: query.declaredValuePaise / 100,
      cod,
    })
    return rows.map((r) => {
      const weight = Number(r.chargeable_weight)
      return {
        serviceId: String(r.id),
        serviceLabel: r.name || 'Xpressbees',
        carrier: null,
        pricePaise: rupeesToPaise(r.total_charges),
        minTransitDays: null,
        maxTransitDays: null,
        // A row quoted for COD is a service that collects cash; a prepaid quote does not say.
        codAvailable: cod ? true : null,
        charges: xpressbeesCharges(r),
        chargeableWeightGrams: Number.isFinite(weight) && weight > 0 ? weight : null,
      }
    })
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const result = await this.request<ShipmentResponse>(
      '/shipments2',
      shipmentBody(input, this.config.warehouseName),
    )
    const awb = result.data?.awb_number
    if (!result.status || !awb) {
      throw new CourierError(
        'rejected',
        this.id,
        `Xpressbees rejected the shipment: ${result.message || 'no detail returned'}`,
      )
    }
    // Cancel, tracking and NDR all key on the AWB, so it doubles as the support reference.
    return { waybill: awb, providerRef: awb, labelUrl: result.data?.label || undefined }
  }

  /** Manifest PDF for AWBs booked today. Not on the shared contract (nothing calls for a
   *  manifest yet); here so the Shipments workspace can add a "Download manifest" button. */
  async generateManifest(waybills: string[]): Promise<string> {
    const result = await this.request<SimpleResponse>('/shipments2/manifest', { awbs: waybills })
    if (!result.status || typeof result.data !== 'string') {
      throw new CourierError(
        'rejected',
        this.id,
        `Xpressbees did not generate a manifest: ${result.message || 'no detail returned'}`,
      )
    }
    return result.data
  }

  async track(waybill: string): Promise<Tracking> {
    const result = await this.request<TrackResponse>(
      `/shipments2/track/${encodeURIComponent(waybill)}`,
    )
    if (!result.status || !result.data) {
      throw new CourierError('bad_response', this.id, 'Xpressbees has no record of this AWB.')
    }
    const history = result.data.history ?? []
    const events: TrackingEvent[] = history.map((h) => ({
      at: xpressbeesTime(h.event_time),
      status: mapXpressbeesStatus(h.status_code, null),
      description: scanDescription(h.status_code, h.message),
      location: h.location || undefined,
    }))
    events.sort((a, b) => a.at.localeCompare(b.at))
    // The coarse status wins over the newest scan for terminal states (a cancelled booking
    // keeps its last pickup scan); otherwise the newest scan is the more precise one.
    const coarse = mapXpressbeesStatus(null, result.data.status)
    const latest = events.at(-1)?.status
    const status = ['cancelled', 'delivered', 'rto'].includes(coarse) ? coarse : (latest ?? coarse)
    return { waybill, status, events }
  }

  async cancel(waybill: string): Promise<void> {
    const result = await this.request<SimpleResponse>('/shipments2/cancel', { awb: waybill })
    if (!result.status) {
      throw new CourierError(
        'rejected',
        this.id,
        `Xpressbees did not cancel the shipment: ${result.message || 'no detail returned'}`,
      )
    }
  }

  async ndrAction(input: NdrActionInput): Promise<NdrActionResult> {
    const body = ndrBody(input)
    if (!body) {
      throw new CourierError(
        'rejected',
        this.id,
        'Xpressbees takes return-to-origin requests from its dashboard, not the API.',
      )
    }
    if (body.length === 0) {
      throw new CourierError('rejected', this.id, 'Give a new address or phone number.')
    }
    const result = await this.request<SimpleResponse>('/ndr/create', body)
    if (result.status === false) {
      throw new CourierError(
        'rejected',
        this.id,
        result.message || 'Xpressbees rejected the NDR action.',
      )
    }
    return { accepted: true }
  }

  /**
   * Xpressbees signs each push with HMAC-SHA256 of the raw body under the secret set on its
   * dashboard's webhook page (base64, `x-hmac-sha256`). A plain shared-secret header is also
   * accepted for accounts set up that way. Fails closed without a configured secret.
   */
  async parseWebhook(request: WebhookRequest): Promise<WebhookNotice[]> {
    const secret = this.config.webhookSecret
    if (!secret) {
      logger.error('webhook refused: no webhookSecret configured', { provider: this.id })
      throw new CourierError('auth', this.id, 'Xpressbees webhook secret is not configured.')
    }
    const signature = firstHeader(request.headers, XPRESSBEES_SIGNATURE_HEADERS)
    const token = firstHeader(request.headers, ['x-webhook-token', 'x-webhook-secret'])
    const ok = signature
      ? hmacSha256Matches(request.rawBody, secret, signature)
      : Boolean(token) && timingSafeEqualString(token, secret)
    if (!ok) throw new CourierError('auth', this.id, 'Xpressbees webhook signature did not match.')

    let body: unknown
    try {
      body = JSON.parse(request.rawBody)
    } catch (error) {
      throw new CourierError('bad_response', this.id, 'Xpressbees webhook body was not JSON.', {
        cause: error,
      })
    }
    const items = Array.isArray(body) ? body : [body]
    return items.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const r = item as Record<string, unknown>
      const awb = r.awb_number ?? r.awb
      if (typeof awb !== 'string' || !awb) return []
      const code = r.status_code ?? r.status ?? ''
      const stamp = r.event_time ?? r.updated_at ?? ''
      return [{ waybill: awb, eventId: `${awb}:${String(code)}:${String(stamp)}` }]
    })
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.tokens.get()
      return { ok: true, message: `Connected to Xpressbees at ${this.baseUrl}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'Xpressbees rejected the email/password. Use the login you sign in to shipment.xpressbees.com with, and ask your Xpressbees manager to enable API access.',
        }
      }
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not verify Xpressbees credentials.',
      }
    }
  }
}

const fields: ProviderField[] = [
  {
    key: 'email',
    label: 'Login email',
    required: true,
    help: 'The email you sign in to shipment.xpressbees.com with.',
  },
  { key: 'password', label: 'Password', secret: true, required: true },
  {
    key: 'warehouseName',
    label: 'Pickup warehouse name',
    required: true,
    help: 'The pickup warehouse name, spelled exactly as on the Xpressbees dashboard.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  { key: 'baseUrl', label: 'API base URL', help: 'Leave blank for production.' },
  {
    key: 'webhookSecret',
    label: 'Webhook secret',
    secret: true,
    help: 'Required for automatic tracking updates. Use the same value as the secret on the Xpressbees webhook page.',
  },
]

export const xpressbeesFactory: ShippingProviderFactory<XpressbeesConfig> = {
  id: 'xpressbees',
  label: 'Xpressbees',
  fields,
  capabilities: XPRESSBEES_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
      errors.push('a valid login email is required')
    }
    if (!r.password?.trim()) errors.push('password is required')
    if (!r.warehouseName?.trim()) errors.push('pickup warehouse name is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    const baseUrlProblem = courierBaseUrlProblem(r.baseUrl, ['xpressbees.com'])
    if (baseUrlProblem) errors.push(baseUrlProblem)
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        email: (r.email as string).trim(),
        password: r.password as string,
        warehouseName: (r.warehouseName as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        baseUrl: r.baseUrl?.trim() || undefined,
        webhookSecret: r.webhookSecret?.trim() || undefined,
      },
    }
  },
  create: (config) => new XpressbeesProvider(config),
}
