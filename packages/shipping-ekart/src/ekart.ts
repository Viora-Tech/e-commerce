/**
 * Ekart adapter: Flipkart's logistics arm, on its Elite platform for e-commerce sellers.
 * Auth is a client id (in the path) plus username/password, answered with a bearer token
 * valid for `expires_in` seconds (about 24h); `LoginTokenCache` keeps it in memory.
 *
 * Every wire shape lives in `mapping.ts` with its source and what still needs a live account.
 *
 *   POST   /integrations/v2/auth/token/{client_id}   token
 *   GET    /api/v2/serviceability/{pincode}           COD, forward drop, reverse pickup
 *   POST   /data/v3/serviceability                    courier groups with TAT and estimate
 *   PUT    /api/v1/package/create                     book (forward, or reverse as `Pickup`)
 *   DELETE /api/v1/package/cancel?tracking_id=        cancel
 *   POST   /api/v1/package/label                      label PDF bytes (see `downloadLabel`)
 *   POST   /data/v2/generate/manifest                 manifest URL
 *   GET    /api/v1/track/{id}                         tracking (open, no token)
 *   POST   /api/v2/package/ndr                        Re-Attempt / RTO
 *   track_updated webhook                              HMAC-SHA256 of the body under its secret
 *
 * NOT IMPLEMENTED: choosing a courier group at booking (the create call takes none; Ekart
 * routes it), wallet (no endpoint), pickup scheduling (set by `preferred_dispatch_date` at
 * booking; we let Ekart pick the next pickup run).
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
  type RateQuery,
  type RateQuote,
  type ReturnPickupInput,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
  type WebhookNotice,
  type WebhookRequest,
} from '@commerce/shipping'
import { EKART_CAPABILITIES } from './client'
import {
  type Acknowledgement,
  type CancelResponse,
  type CreateResponse,
  EKART_BASE_URL,
  EKART_SIGNATURE_HEADERS,
  forwardBody,
  type ManifestResponse,
  mapEkartStatus,
  ndrBody,
  type PincodeResponse,
  type RouteOption,
  reverseBody,
  rupeesToPaise,
  type SellerDetails,
  scanDescription,
  type TokenResponse,
  type TrackResponse,
  trackingUrl,
} from './mapping'

export { EKART_BASE_URL }

export type EkartConfig = SellerDetails & {
  /** Issued by Ekart at onboarding; part of the token URL. */
  clientId: string
  username: string
  password: string
  originPincode: string
  baseUrl?: string | undefined
  /** The secret registered with the `track_updated` webhook (6-30 characters). Required for
   *  webhooks: without it every push is refused. */
  webhookSecret?: string | undefined
  fetchImpl?: typeof fetch | undefined
}

const msToIso = (ms: number | undefined) =>
  typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : undefined

export class EkartProvider implements ShippingProvider {
  readonly id = 'ekart'
  readonly label = 'Ekart'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly tokens: LoginTokenCache

  constructor(private readonly config: EkartConfig) {
    this.baseUrl = (config.baseUrl || EKART_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
    this.tokens = new LoginTokenCache(() => this.login())
  }

  private async login(): Promise<{ token: string; lifetimeMs: number }> {
    const res = await courierFetch(
      this.id,
      `${this.baseUrl}/integrations/v2/auth/token/${encodeURIComponent(this.config.clientId)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username: this.config.username, password: this.config.password }),
        fetchImpl: this.fetchImpl,
        timeoutMs: COURIER_TIMEOUT_MS,
      },
    )
    const body = await courierJson<TokenResponse>(this.id, res)
    if (!body.access_token) {
      throw new CourierError('auth', this.id, 'Ekart did not return an access token.')
    }
    const seconds = typeof body.expires_in === 'number' ? body.expires_in : 3600
    return { token: body.access_token, lifetimeMs: seconds * 1000 }
  }

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    return this.tokens.withToken((token) =>
      courierFetch(this.id, `${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        fetchImpl: this.fetchImpl,
        timeoutMs: COURIER_TIMEOUT_MS,
      }),
    )
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    return courierJson<T>(this.id, await this.send(method, path, body))
  }

  private pincode(pincode: string): Promise<PincodeResponse> {
    return this.json<PincodeResponse>(
      'GET',
      `/api/v2/serviceability/${encodeURIComponent(pincode)}`,
    )
  }

  private routes(query: {
    originPincode: string
    destinationPincode: string
    weightGrams: number
    valueRupees: number
    cod: boolean
  }): Promise<RouteOption[]> {
    const invoice = String(Math.max(Math.round(query.valueRupees), 1))
    return this.json<RouteOption[]>('POST', '/data/v3/serviceability', {
      pickupPincode: query.originPincode,
      dropPincode: query.destinationPincode,
      length: '10',
      width: '10',
      height: '10',
      weight: String(Math.max(Math.ceil(query.weightGrams), 1)),
      paymentType: query.cod ? 'COD' : 'Prepaid',
      invoiceAmount: invoice,
      ...(query.cod ? { codAmount: invoice } : {}),
    }).then((rows) => (Array.isArray(rows) ? rows : []))
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const drop = await this.pincode(query.destinationPincode)
    const serviceable = drop.status === true && drop.details?.forward_drop !== false
    if (!serviceable) {
      return {
        provider: this.id,
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        minTransitDays: null,
        maxTransitDays: null,
        reason: drop.remark || 'Ekart does not deliver to this PIN code.',
      }
    }
    // Transit days come from the route lookup; it failing never hides a serviceable PIN.
    const routes = await this.routes({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams ?? 500,
      valueRupees: query.declaredValue ?? 0,
      cod: false,
    }).catch(() => [] as RouteOption[])
    const mins = routes.map((r) => r.tat?.min).filter((n): n is number => typeof n === 'number')
    const maxs = routes.map((r) => r.tat?.max).filter((n): n is number => typeof n === 'number')
    return {
      provider: this.id,
      serviceable: true,
      codAvailable: drop.details?.cod === true,
      prepaidAvailable: true,
      minTransitDays: mins.length ? Math.min(...mins) : null,
      maxTransitDays: maxs.length ? Math.max(...maxs) : null,
      reason: null,
    }
  }

  /** The cheapest courier group's delivered estimate. One number only: the booking call
   *  cannot pick a group, so listing them as options would offer choices that do nothing. */
  async quoteRate(query: RateQuery): Promise<RateQuote | null> {
    const routes = await this.routes({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      valueRupees: query.declaredValuePaise / 100,
      cod: query.paymentMode === 'cod',
    })
    const priced = routes
      .map((r) => ({
        r,
        paise: rupeesToPaise(r.forwardDeliveredCharges?.totalForwardDeliveredEstimate),
      }))
      .filter((x) => x.paise > 0)
    if (priced.length === 0) return null
    const best = priced.reduce((min, x) => (x.paise < min.paise ? x : min))
    return {
      pricePaise: best.paise,
      minTransitDays: best.r.tat?.min ?? null,
      maxTransitDays: best.r.tat?.max ?? null,
    }
  }

  private booked(result: CreateResponse, what: string): CreateShipmentResult {
    if (!result.status || !result.tracking_id) {
      throw new CourierError(
        'rejected',
        this.id,
        `Ekart rejected the ${what}: ${result.remark || 'no detail returned'}`,
      )
    }
    // The Ekart tracking id is what tracking, cancel, label and NDR all take.
    return { waybill: result.tracking_id, providerRef: result.barcodes?.wbn || result.tracking_id }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const result = await this.json<CreateResponse>(
      'PUT',
      '/api/v1/package/create',
      forwardBody(input, this.config),
    )
    return this.booked(result, 'shipment')
  }

  async createReturnPickup(input: ReturnPickupInput): Promise<CreateShipmentResult> {
    const result = await this.json<CreateResponse>(
      'PUT',
      '/api/v1/package/create',
      reverseBody(input, this.config),
    )
    return this.booked(result, 'return pickup')
  }

  /** The 4x6 label PDF for up to 100 tracking ids. Ekart sends bytes, not a link, so this is
   *  not wired to the admin's label button yet (that opens a URL); a label proxy route can
   *  stream this. */
  async downloadLabel(trackingIds: string[]): Promise<ArrayBuffer> {
    const res = await this.send('POST', '/api/v1/package/label?json_only=false', {
      ids: trackingIds,
    })
    return res.arrayBuffer()
  }

  /** Manifest PDF link for up to 100 tracking ids. Not on the shared contract yet. */
  async generateManifest(trackingIds: string[]): Promise<string> {
    const result = await this.json<ManifestResponse>('POST', '/data/v2/generate/manifest', {
      ids: trackingIds,
    })
    if (!result.manifestDownloadUrl) {
      throw new CourierError('bad_response', this.id, 'Ekart returned no manifest link.')
    }
    return result.manifestDownloadUrl
  }

  /** The open tracking API: no token is sent, per Ekart's docs. */
  async track(waybill: string): Promise<Tracking> {
    const res = await courierFetch(
      this.id,
      `${this.baseUrl}/api/v1/track/${encodeURIComponent(waybill)}`,
      { headers: { Accept: 'application/json' }, fetchImpl: this.fetchImpl },
    )
    const data = await courierJson<TrackResponse>(this.id, res)
    if (!data.track?.status) {
      throw new CourierError('bad_response', this.id, 'Ekart has no record of this shipment.')
    }
    const details = data.track.details?.length
      ? data.track.details
      : [
          {
            ndrStatus: data.track.ndrStatus,
            status: data.track.status,
            ctime: data.track.ctime,
            desc: data.track.desc,
            location: data.track.location,
          },
        ]
    const events: TrackingEvent[] = details.map((d) => ({
      at: msToIso(d.ctime) ?? new Date(0).toISOString(),
      status: mapEkartStatus(d.status),
      description: scanDescription(d),
      location: d.location || undefined,
    }))
    events.sort((a, b) => a.at.localeCompare(b.at))
    return {
      waybill,
      status: mapEkartStatus(data.track.status),
      events,
      trackingUrl: trackingUrl(waybill),
      expectedDate: msToIso(data.edd)?.slice(0, 10),
    }
  }

  async cancel(waybill: string): Promise<void> {
    const result = await this.json<CancelResponse | Acknowledgement>(
      'DELETE',
      `/api/v1/package/cancel?tracking_id=${encodeURIComponent(waybill)}`,
    )
    // Documented as `{ data: [ack] }`; a bare ack is read too.
    const ack =
      'data' in result && Array.isArray(result.data) ? result.data[0] : (result as Acknowledgement)
    if (!ack?.status) {
      throw new CourierError(
        'rejected',
        this.id,
        `Ekart did not cancel the shipment: ${ack?.remark || 'no detail returned'}`,
      )
    }
  }

  async ndrAction(input: NdrActionInput): Promise<NdrActionResult> {
    const result = await this.json<Acknowledgement>('POST', '/api/v2/package/ndr', ndrBody(input))
    if (result.status === false) {
      throw new CourierError('rejected', this.id, result.remark || 'Ekart rejected the NDR action.')
    }
    return { accepted: true }
  }

  /** `track_updated` pushes: verified against the HMAC-SHA256 of the raw body. The id in the
   *  payload is Ekart's tracking id, the waybill we stored. Fails closed without a secret. */
  async parseWebhook(request: WebhookRequest): Promise<WebhookNotice[]> {
    const secret = this.config.webhookSecret
    if (!secret) {
      logger.error('webhook refused: no webhookSecret configured', { provider: this.id })
      throw new CourierError('auth', this.id, 'Ekart webhook secret is not configured.')
    }
    const signature = firstHeader(request.headers, EKART_SIGNATURE_HEADERS)
    if (!signature || !hmacSha256Matches(request.rawBody, secret, signature)) {
      throw new CourierError('auth', this.id, 'Ekart webhook signature did not match.')
    }
    let body: unknown
    try {
      body = JSON.parse(request.rawBody)
    } catch (error) {
      throw new CourierError('bad_response', this.id, 'Ekart webhook body was not JSON.', {
        cause: error,
      })
    }
    const items = Array.isArray(body) ? body : [body]
    return items.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const r = item as Record<string, unknown>
      const id = r.id
      if (typeof id !== 'string' || !id) return []
      return [{ waybill: id, eventId: `${id}:${String(r.status ?? '')}:${String(r.ctime ?? '')}` }]
    })
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.tokens.get()
      return { ok: true, message: `Connected to Ekart at ${this.baseUrl}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'Ekart rejected the client id, username or password. Use the API credentials from your Ekart onboarding email.',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify Ekart credentials.',
      }
    }
  }
}

const fields: ProviderField[] = [
  {
    key: 'clientId',
    label: 'Client ID',
    required: true,
    help: 'From your Ekart onboarding email.',
  },
  { key: 'username', label: 'API username', required: true },
  { key: 'password', label: 'API password', secret: true, required: true },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  {
    key: 'pickupAlias',
    label: 'Pickup address alias',
    help: 'The alias of your registered pickup address on Ekart. Leave blank if you registered only one.',
  },
  { key: 'sellerName', label: 'Seller name', required: true, help: 'Printed on the label.' },
  { key: 'sellerAddress', label: 'Seller billing address', required: true },
  { key: 'sellerGstin', label: 'Seller GSTIN', help: 'Leave blank if you are not GST registered.' },
  { key: 'baseUrl', label: 'API base URL', help: 'Leave blank for production.' },
  {
    key: 'webhookSecret',
    label: 'Webhook secret',
    secret: true,
    help: 'Required for automatic tracking updates: the 6-30 character secret on your Ekart track_updated webhook.',
  },
]

export const ekartFactory: ShippingProviderFactory<EkartConfig> = {
  id: 'ekart',
  label: 'Ekart',
  fields,
  capabilities: EKART_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.clientId?.trim()) errors.push('client ID is required')
    if (!r.username?.trim()) errors.push('API username is required')
    if (!r.password?.trim()) errors.push('API password is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    if (!r.sellerName?.trim()) errors.push('seller name is required')
    if (!r.sellerAddress?.trim()) errors.push('seller billing address is required')
    const gstin = r.sellerGstin?.trim().toUpperCase()
    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin)) errors.push('GSTIN must be 15 characters')
    const secret = r.webhookSecret?.trim()
    if (secret && (secret.length < 6 || secret.length > 30)) {
      errors.push('webhook secret must be 6 to 30 characters')
    }
    const baseUrlProblem = courierBaseUrlProblem(r.baseUrl, ['ekartlogistics.in'])
    if (baseUrlProblem) errors.push(baseUrlProblem)
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        clientId: (r.clientId as string).trim(),
        username: (r.username as string).trim(),
        password: r.password as string,
        originPincode: (r.originPincode as string).trim(),
        pickupAlias: r.pickupAlias?.trim() ?? '',
        sellerName: (r.sellerName as string).trim(),
        sellerAddress: (r.sellerAddress as string).trim(),
        sellerGstin: gstin ?? '',
        baseUrl: r.baseUrl?.trim() || undefined,
        webhookSecret: secret || undefined,
      },
    }
  },
  create: (config) => new EkartProvider(config),
}
