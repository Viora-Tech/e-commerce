/**
 * Delhivery adapter. Ported from two of Kuldeep's earlier integrations:
 * the Shopify delivery-promise app (serviceability + expected TAT) and the
 * Medusa fulfilment plugin (waybill, shipment create, track, cancel).
 *
 * Endpoints, all under {base}, all `Authorization: Token {apiToken}`:
 *
 *   GET  /c/api/pin-codes/json/?filter_codes={pin}          serviceability
 *   GET  /api/dc/expected_tat?origin_pin=&destination_pin=   transit days
 *   GET  /waybill/api/bulk/json/?count=1                     reserve a waybill
 *   POST /api/cmu/create.json  (form: format=json&data=…)    create shipment
 *   GET  /api/v1/packages/json/?waybill=                     tracking
 *   POST /api/p/edit           (form: waybill=&cancellation=true)
 *
 * TWO CALLS FOR AN ESTIMATE, NOT ONE
 *
 * Serviceability answers "will we carry a parcel there, and can it be COD" -
 * and says nothing about how long. Transit time lives on the expected_tat
 * endpoint. Verified against a live account: 2 days Sonipat to Delhi, 5 to
 * Bangalore, 9 to Kochi, 11 to Port Blair. Without it every destination in
 * the country shares one flat estimate.
 *
 * TAT FAILING MUST NOT FAIL THE LOOKUP. It is a second network call on an
 * endpoint whose availability depends on the account, so its failure is
 * swallowed - transit days come back null and the caller falls back to the
 * merchant's configured figures. Serviceability is the answer the customer
 * needs; the number of days is an improvement on it.
 *
 * The token comes from the store's encrypted settings, never from the
 * environment: each store ships on its own account.
 */

import {
  COURIER_TIMEOUT_MS,
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  courierFetch,
  courierJson,
  isValidPincode,
  type NdrActionInput,
  type NdrActionResult,
  type ProviderField,
  type SchedulePickupInput,
  type SchedulePickupResult,
  type Serviceability,
  type ServiceabilityQuery,
  type ShipmentStatus,
  type ShippingCapability,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
  timingSafeEqualString,
  type WebhookNotice,
  type WebhookRequest,
} from '@commerce/shipping'

/** Production. Staging is https://staging-express.delhivery.com for test keys. */
export const DELHIVERY_BASE_URL = 'https://track.delhivery.com'
export const DELHIVERY_STAGING_URL = 'https://staging-express.delhivery.com'

export type DelhiveryConfig = {
  apiToken: string
  /** Delhivery client name (the "warehouse owner" on the account). */
  clientName: string
  /** Registered pickup location name, exactly as on the Delhivery dashboard. */
  pickupLocationName: string
  originPincode: string
  baseUrl?: string | undefined
  /** "S" surface or "E" express. Surface by default: it is the slower quote,
   *  and defaulting to the slower one means a misconfigured store promises too
   *  much time rather than too little. */
  mode?: 'S' | 'E' | undefined
  /**
   * A shared secret the merchant also pastes into the "extra header" field
   * Delhivery's merchant portal lets you attach to a registered webhook
   * (Merchant Portal → API → Webhooks). Delhivery's public docs describe the
   * webhook as "share any extra details which need to be passed along with
   * the scan data such as authorization header" without naming a fixed
   * signature scheme, so this is the one thing our side can actually check:
   * we send this value back to Delhivery as the header they attach, and
   * `parseWebhook` rejects a call that does not carry it — matched with a
   * timing-safe comparison. Required: leaving it blank does not disable the
   * check, it fails every webhook call closed (see `parseWebhook`), because
   * accepting unauthenticated pushes once this URL is public is not safe.
   */
  webhookSecret?: string | undefined
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined
}

type PostalCode = {
  pin?: number
  /** "Y" / "N" - cash on delivery. */
  cod?: string
  /** "Y" / "N" - prepaid accepted. */
  pre_paid?: string
  remarks?: string
}

type ServiceabilityResponse = { delivery_codes?: Array<{ postal_code?: PostalCode }> }

type TatResponse = { success?: boolean; data?: { tat?: number } }

type WaybillResponse = string | { waybill?: string; response?: string }

type CreateResponse = {
  success?: boolean
  rmk?: string
  error?: string
  packages?: Array<{ waybill?: string; status?: string; error?: string; remarks?: string[] }>
}

type TrackResponse = {
  ShipmentData?: Array<{
    Shipment?: {
      AWB?: string
      Status?: {
        Status?: string
        StatusType?: string
        StatusDateTime?: string
        Instructions?: string
      }
      Scans?: Array<{
        ScanDetail?: {
          Scan?: string
          ScanType?: string
          ScanDateTime?: string
          ScannedLocation?: string
          Instructions?: string
        }
      }>
      ExpectedDeliveryDate?: string
    }
  }>
}

type PickupResponse = { pickup_id?: number | string; pr_exist?: boolean; success?: boolean }

/** Shape returned by /api/p/update, per the "Asynchronous NDR Package Action API" reference doc. */
type NdrUpdateResponse = { upl?: string; UploadWbns?: string; success?: boolean; error?: string }

const isYes = (value: string | undefined): boolean =>
  typeof value === 'string' && value.trim().toUpperCase() === 'Y'

/**
 * Delhivery's scan vocabulary, reduced to ours. StatusType is the reliable
 * field: UD (undelivered = in flight), DL (delivered), RT (return), CN
 * (cancelled), PP (pending pickup). The free-text Status refines "in flight"
 * into picked up / out for delivery.
 */
export function mapDelhiveryStatus(
  statusType: string | undefined,
  status: string | undefined,
): ShipmentStatus {
  const type = (statusType ?? '').toUpperCase()
  const text = (status ?? '').toLowerCase()
  if (type === 'DL' || text.includes('delivered')) return 'delivered'
  if (type === 'RT' || text.startsWith('rto') || text.includes('returned')) return 'rto'
  if (type === 'CN' || text.includes('cancel')) return 'cancelled'
  if (text.includes('dispatched') || text.includes('out for delivery')) return 'out_for_delivery'
  if (type === 'PP' || text.includes('manifested') || text === 'not picked') return 'created'
  if (text.includes('picked') || text.includes('pickup')) return 'picked_up'
  if (type === 'UD') return 'in_transit'
  return 'in_transit'
}

export class DelhiveryProvider implements ShippingProvider {
  readonly id = 'delhivery'
  readonly label = 'Delhivery'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly config: DelhiveryConfig) {
    this.baseUrl = (config.baseUrl || DELHIVERY_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Token ${this.config.apiToken}`, Accept: 'application/json', ...extra }
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      headers: this.headers(),
      fetchImpl: this.fetchImpl,
    })
    return courierJson<T>(this.id, res)
  }

  private async postForm<T>(path: string, body: string): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body,
      fetchImpl: this.fetchImpl,
    })
    return courierJson<T>(this.id, res)
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      fetchImpl: this.fetchImpl,
    })
    return courierJson<T>(this.id, res)
  }

  /**
   * Expected transit days, or null when Delhivery will not say. Never throws:
   * a thrown error here would turn a perfectly good serviceability answer
   * into "could not check right now".
   */
  private async transitDays(origin: string, destination: string): Promise<number | null> {
    const q = new URLSearchParams({
      origin_pin: origin,
      destination_pin: destination,
      /* pdt=B2C is fixed. B2B quotes faster - Sonipat to Kochi is 5 days rather
         than 11 - but it is business freight with different pricing and terms,
         and putting those numbers on a consumer product page is a promise the
         shipment cannot keep. mot is the merchant's choice: surface and
         express differ by five days to Kochi. */
      mot: this.config.mode ?? 'S',
      pdt: 'B2C',
    })
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/api/dc/expected_tat?${q}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(COURIER_TIMEOUT_MS),
      })
      if (!res.ok) return null
      const body = (await res.json()) as TatResponse
      const tat = body?.data?.tat
      /* Positive integers only. A zero would claim same-day delivery across
         the country, and a negative or fractional value is a shape change we
         should decline rather than round. */
      if (typeof tat !== 'number' || !Number.isFinite(tat) || tat < 1) return null
      return Math.ceil(tat)
    } catch {
      return null
    }
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const data = await this.getJson<ServiceabilityResponse>(
      `/c/api/pin-codes/json/?filter_codes=${encodeURIComponent(query.destinationPincode)}`,
    )
    const entry = data.delivery_codes?.[0]?.postal_code

    /* An empty delivery_codes array is a successful lookup with a negative
       answer, not a failure. "We don't deliver there" is the truth and gets
       shown to the customer; a transport failure is our problem and gets a
       fallback. */
    if (!entry) {
      return {
        provider: this.id,
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        minTransitDays: null,
        maxTransitDays: null,
        reason: 'Delhivery does not currently deliver to this PIN code.',
      }
    }

    /* Only asked once the parcel is known to be deliverable. A transit time
       for a PIN code Delhivery does not serve is a round trip nobody reads. */
    const tat = await this.transitDays(query.originPincode, query.destinationPincode)

    return {
      provider: this.id,
      serviceable: true,
      codAvailable: isYes(entry.cod),
      prepaidAvailable: isYes(entry.pre_paid),
      /* Both ends carry Delhivery's own figure. Widening it into a range is
         the caller's decision, not the courier's. */
      minTransitDays: tat,
      maxTransitDays: tat,
      reason: null,
    }
  }

  async reserveWaybill(): Promise<string> {
    const data = await this.getJson<WaybillResponse>('/waybill/api/bulk/json/?count=1')
    const waybill = typeof data === 'string' ? data : (data?.waybill ?? data?.response ?? '')
    if (!waybill) throw new CourierError('bad_response', this.id, 'Delhivery returned no waybill.')
    return waybill
  }

  /** The exact JSON Delhivery's create endpoint wants, built from our neutral input. */
  buildShipmentPayload(input: CreateShipmentInput, waybill: string) {
    const rupees = (paise: number) => (paise / 100).toFixed(2)
    const address = (a: CreateShipmentInput['to']) => [a.line1, a.line2].filter(Boolean).join(', ')
    return {
      shipments: [
        {
          name: input.to.name,
          add: address(input.to),
          pin: input.to.pincode,
          city: input.to.city,
          state: input.to.state,
          country: input.to.country || 'IN',
          phone: input.to.phone,
          order: String(input.orderNumber),
          payment_mode: input.paymentMode === 'cod' ? 'COD' : 'Prepaid',
          cod_amount: input.paymentMode === 'cod' ? rupees(input.codAmountPaise) : '0',
          weight: input.weightGrams,
          quantity: input.lines.reduce((n, l) => n + l.quantity, 0),
          commodity_value: rupees(input.valuePaise),
          products_desc: input.lines
            .map((l) => `${l.title} x${l.quantity}`)
            .join(', ')
            .slice(0, 250),
          pickup_location: this.config.pickupLocationName,
          waybill,
          return_name: input.from.name,
          return_add: address(input.from),
          return_pin: input.from.pincode,
          return_city: input.from.city,
          return_state: input.from.state,
          return_country: input.from.country || 'IN',
          return_phone: input.from.phone,
          seller_name: this.config.clientName,
        },
      ],
      pickup_location: { name: this.config.pickupLocationName },
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const waybill = await this.reserveWaybill()
    const payload = this.buildShipmentPayload(input, waybill)
    const result = await this.postForm<CreateResponse>(
      '/api/cmu/create.json',
      `format=json&data=${encodeURIComponent(JSON.stringify(payload))}`,
    )

    const packages = result.packages ?? []
    const ok =
      result.success === true ||
      (packages.length > 0 && packages.every((p) => !p.error && p.status !== 'Error'))
    if (!ok) {
      const detail = [
        ...packages.map((p) => p.error ?? p.remarks?.join(' ')).filter(Boolean),
        result.rmk,
        result.error,
      ]
        .filter(Boolean)
        .join(' | ')
      throw new CourierError(
        'rejected',
        this.id,
        `Delhivery rejected the shipment: ${detail || 'no detail returned'}`,
      )
    }

    const assigned = packages[0]?.waybill || waybill
    return {
      waybill: assigned,
      providerRef: assigned,
      labelUrl: `${this.baseUrl}/api/p/packing_slip?wbns=${encodeURIComponent(assigned)}&pdf=true`,
    }
  }

  async track(waybill: string): Promise<Tracking> {
    const data = await this.getJson<TrackResponse>(
      `/api/v1/packages/json/?waybill=${encodeURIComponent(waybill)}`,
    )
    const shipment = data.ShipmentData?.[0]?.Shipment
    if (!shipment)
      throw new CourierError('bad_response', this.id, 'Delhivery has no record of this waybill.')

    const events: TrackingEvent[] = (shipment.Scans ?? [])
      .map((s) => s.ScanDetail)
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map((d) => ({
        at: d.ScanDateTime ? new Date(d.ScanDateTime).toISOString() : new Date(0).toISOString(),
        status: mapDelhiveryStatus(d.ScanType, d.Scan),
        description: d.Instructions || d.Scan || '',
        location: d.ScannedLocation,
      }))
      .sort((a, b) => a.at.localeCompare(b.at))

    return {
      waybill: shipment.AWB ?? waybill,
      status: mapDelhiveryStatus(shipment.Status?.StatusType, shipment.Status?.Status),
      events,
      trackingUrl: `https://www.delhivery.com/track/package/${encodeURIComponent(waybill)}`,
      expectedDate: shipment.ExpectedDeliveryDate?.slice(0, 10),
    }
  }

  async cancel(waybill: string): Promise<void> {
    await this.postForm<unknown>(
      '/api/p/edit',
      `waybill=${encodeURIComponent(waybill)}&cancellation=true`,
    )
  }

  /**
   * Create Pickup API - `POST /fm/request/new/`, JSON body
   * `{ pickup_location, pickup_time, pickup_date, expected_package_count }`,
   * returns `pickup_id` (https://delhivery-express-api-doc.readme.io/reference/pickup-request-creation-api).
   * The doc excerpt does not confirm the exact success/failure JSON shape, so
   * a response with neither `pickup_id` nor `pr_exist: true` is treated as a
   * rejection rather than guessed at.
   */
  async schedulePickup(input: SchedulePickupInput): Promise<SchedulePickupResult> {
    const result = await this.postJson<PickupResponse>('/fm/request/new/', {
      pickup_location: input.pickupLocationName,
      pickup_time: input.timeFrom,
      pickup_date: input.date,
      expected_package_count: input.expectedPackageCount,
    })
    const id = result.pickup_id
    if (!id && !result.pr_exist) {
      throw new CourierError(
        'rejected',
        this.id,
        'Delhivery did not confirm the pickup request. Check the pickup location name matches the dashboard exactly.',
      )
    }
    return { providerPickupId: id ? String(id) : 'existing' }
  }

  /**
   * Asynchronous NDR Package Action API - `POST /api/p/update`
   * (https://delhivery-express-api-doc.readme.io/reference/asynchronous-ndr-package-action-api).
   * `RE-ATTEMPT` and `EDIT_DETAILS` (used for change-of-address) only accept a
   * shipment whose current scan is one of a fixed set of pending NDR codes;
   * Delhivery answers those from `act`/status, not from this call, so a
   * rejection here most often means the parcel already moved past NDR.
   * There is no separate "mark RTO" action in this API - RTO is what
   * Delhivery does automatically once reattempts are exhausted, so `rto`
   * here is mapped to `RE-ATTEMPT` with a comment recording the merchant's
   * intent; this is a best-effort mapping, isolated behind the connector,
   * and should be revisited once a sandbox account can confirm it.
   */
  async ndrAction(input: NdrActionInput): Promise<NdrActionResult> {
    const act = input.action === 'change_address' ? 'EDIT_DETAILS' : 'RE-ATTEMPT'
    const actionData: Record<string, string> = {}
    if (input.action === 'change_address') {
      if (input.name) actionData.name = input.name
      if (input.phone) actionData.phone = input.phone
      if (input.address) actionData.add = input.address
    }
    if (input.deferredDate) actionData.deferred_date = input.deferredDate
    if (input.comment) actionData.comment = input.comment
    const result = await this.postJson<NdrUpdateResponse>('/api/p/update', {
      data: [{ waybill: input.waybill, act, action_data: actionData }],
    })
    if (result.success === false) {
      throw new CourierError(
        'rejected',
        this.id,
        result.error || 'Delhivery rejected the NDR action.',
      )
    }
    return { accepted: true, providerRef: result.upl ?? result.UploadWbns }
  }

  /**
   * Delhivery pushes a scan whenever it happens (Merchant Portal → API →
   * Webhooks); the public docs describe the delivery mechanism but not a
   * fixed signature header, so the only check this side can make is the
   * shared secret the merchant copies into both places (see
   * `DelhiveryConfig.webhookSecret`). We deliberately do not trust the
   * pushed payload's shape for status - `track()` is re-run for every AWB
   * this reports, so a change to Delhivery's webhook body never desyncs us
   * from what `track()` already returns correctly.
   */
  async parseWebhook(request: WebhookRequest): Promise<WebhookNotice[]> {
    // Fail closed: no configured secret means we cannot tell a genuine call
    // from a stray one, so every webhook is refused until one is set (the
    // Connect page marks it required for automatic tracking).
    if (!this.config.webhookSecret) {
      console.error('[delhivery] webhook received with no webhookSecret configured; refusing')
      throw new CourierError('auth', this.id, 'Delhivery webhook secret is not configured.')
    }
    const got = request.headers['x-webhook-token'] ?? request.headers.authorization ?? ''
    if (!timingSafeEqualString(got, this.config.webhookSecret)) {
      throw new CourierError('auth', this.id, 'Delhivery webhook token did not match.')
    }
    let body: unknown
    try {
      body = JSON.parse(request.rawBody)
    } catch (error) {
      throw new CourierError('bad_response', this.id, 'Delhivery webhook body was not JSON.', {
        cause: error,
      })
    }
    // Accept a few shapes: a single scan object, a `{ Shipment: {...} }`
    // wrapper (matches the tracking response), or an array of either.
    const awbOf = (o: unknown): string | undefined => {
      if (!o || typeof o !== 'object') return undefined
      const r = o as Record<string, unknown>
      const shipment = (r.Shipment ?? r.shipment ?? r) as Record<string, unknown> | undefined
      const awb = shipment?.AWB ?? shipment?.awb ?? shipment?.waybill ?? r.waybill
      return typeof awb === 'string' && awb ? awb : undefined
    }
    const items = Array.isArray(body) ? body : [body]
    const notices: WebhookNotice[] = []
    for (const item of items) {
      const waybill = awbOf(item)
      if (!waybill) continue
      const r = item as Record<string, unknown>
      const shipment = (r.Shipment ?? r.shipment ?? r) as Record<string, unknown>
      const stamp = shipment.StatusDateTime ?? shipment.statusDateTime ?? Date.now()
      notices.push({ waybill, eventId: `${waybill}:${stamp}` })
    }
    return notices
  }

  /**
   * Checks the token against a PIN code that is certain to exist rather than
   * one the merchant typed, so a failure here always means the credential and
   * never a typo.
   */
  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.getJson<ServiceabilityResponse>('/c/api/pin-codes/json/?filter_codes=110001')
      return { ok: true, message: `Connected to Delhivery at ${this.baseUrl}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'Delhivery rejected the token. Check it is the API token for this account, and that the base URL matches the environment it was issued for - a staging token fails against production.',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify the Delhivery token.',
      }
    }
  }
}

const fields: ProviderField[] = [
  { key: 'apiToken', label: 'API token', secret: true, required: true },
  {
    key: 'clientName',
    label: 'Client name',
    required: true,
    help: 'As shown on the Delhivery dashboard.',
  },
  {
    key: 'pickupLocationName',
    label: 'Pickup location name',
    required: true,
    help: 'The registered warehouse name, spelled exactly as on the dashboard.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  {
    key: 'baseUrl',
    label: 'API base URL',
    help: `Leave blank for production. Staging: ${DELHIVERY_STAGING_URL}`,
  },
  {
    key: 'expressMode',
    label: 'Quote Express transit times',
    type: 'boolean',
    help: 'Off quotes Surface, the slower and safer promise.',
  },
  {
    key: 'webhookSecret',
    label: 'Webhook shared secret',
    secret: true,
    help:
      'Required for automatic tracking updates via webhook (a webhook call without it is refused). ' +
      'Paste the same value into the extra header field when you register the tracking ' +
      'webhook in the Delhivery Merchant Portal (API → Webhooks), so we can tell a genuine call from a stray one.',
  },
]

/** What this adapter can do today; the admin greys out anything not listed. Rates: Delhivery has
 *  no quote endpoint, checkout prices shipping from the merchant's own zones instead. Manifest and
 *  wallet: no confirmed public API (see delhivery.ts and the courier app's wallet card), so both are
 *  left off rather than guessed at. */
export const DELHIVERY_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'create_shipment',
  'label',
  'pickup',
  'tracking',
  'webhook',
  'cancel',
  'ndr',
]

export const delhiveryFactory: ShippingProviderFactory<DelhiveryConfig> = {
  id: 'delhivery',
  label: 'Delhivery',
  fields,
  capabilities: DELHIVERY_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.apiToken?.trim()) errors.push('API token is required')
    if (!r.clientName?.trim()) errors.push('client name is required')
    if (!r.pickupLocationName?.trim()) errors.push('pickup location name is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    if (r.baseUrl?.trim() && !/^https:\/\//.test(r.baseUrl.trim()))
      errors.push('base URL must start with https://')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        apiToken: (r.apiToken as string).trim(),
        clientName: (r.clientName as string).trim(),
        pickupLocationName: (r.pickupLocationName as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        baseUrl: r.baseUrl?.trim() || undefined,
        mode: r.expressMode === 'true' ? 'E' : 'S',
        webhookSecret: r.webhookSecret?.trim() || undefined,
      },
    }
  },
  create: (config) => new DelhiveryProvider(config),
}
