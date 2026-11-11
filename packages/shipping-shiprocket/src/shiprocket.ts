/**
 * Shiprocket adapter - a multi-courier aggregator, unlike Delhivery which is a
 * single carrier. Shiprocket picks from many underlying couriers (Delhivery,
 * Xpressbees, Ecom Express, Bluedart, ...) per shipment, so this adapter
 * exposes rate comparison (`quoteRate`/`checkServiceability`) across whatever
 * couriers are serviceable for a route, and `createShipment` books one.
 *
 * Base URL and endpoints confirmed against the community Go SDKs
 * (github.com/timslabs/shiprocket-go/constants and
 * github.com/Niyantra-Labs/shiprocket-gosdk/courier, both generated from
 * Shiprocket's own docs/Postman collection - the official docs site at
 * apidocs.shiprocket.in is a JS-rendered SPA this environment cannot render)
 * and the public API helpsheet at
 * support.shiprocket.in/support/solutions/articles/43000337456. All under
 * https://apiv2.shiprocket.in/v1/external, bearer auth:
 *
 *   POST /auth/login                       {email,password} -> {token}, valid 240h
 *   GET  /courier/serviceability/           rates + ETA per courier for a route
 *   POST /orders/create/adhoc               create order -> order_id, shipment_id
 *   POST /courier/assign/awb                {shipment_id, courier_id} -> awb_code
 *   POST /courier/generate/label            {shipment_id: [...]}  -> label_url
 *   POST /courier/generate/pickup           {shipment_id: [...]}
 *   POST /manifests/generate                {shipment_id: [...]}
 *   GET  /courier/track/awb/{awb_code}
 *   POST /orders/cancel                     {ids: [...]}
 *   POST /orders/cancel/shipment/awbs       {awbs: [...]}  cancel a booked shipment
 *   POST /ndr/reattempt                     {awb, address1, address2, phone, deferred_date}
 *   GET  /account/details/wallet-balance
 *
 * NOT IMPLEMENTED, LEFT OUT OF CAPABILITIES: the NDR endpoint's exact success/
 * failure shape and whether it truly supports address-change (vs. reattempt
 * only) could not be confirmed from any fetchable source, so `ndrAction` is
 * still wired (best-effort, like Delhivery's) but flagged in its own comment.
 * Insurance and B2B/freight quoting are not covered here at all.
 *
 * AUTH TOKEN: Shiprocket issues one bearer token per email+password login,
 * good for 240 hours. It is cached on the instance and refreshed a day early
 * rather than on expiry, so a slow request never race with an expired token.
 * The instance-level cache does not survive process restarts (this runs in
 * short-lived request handlers and the worker); that just costs one extra
 * login call per cold start; the token itself is never treated as a durable
 * secret (nothing is persisted from it here).
 */

import { logger } from '@commerce/observability/logging'
import {
  COURIER_TIMEOUT_MS,
  CourierError,
  type CancelRef,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  courierBaseUrlProblem,
  courierFetch,
  courierJson,
  courierTimeToIso,
  isValidPincode,
  type NdrActionInput,
  type NdrActionResult,
  type ProviderField,
  type PushOrderResult,
  type RateCharge,
  type RateOption,
  type RateQuery,
  type RateQuote,
  type ReturnPickupInput,
  type SchedulePickupInput,
  type SchedulePickupResult,
  type Serviceability,
  type ServiceabilityQuery,
  type ShipmentStatus,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
  timingSafeEqualString,
  type WalletBalance,
  type WebhookNotice,
  type WebhookRequest,
} from '@commerce/shipping'
import { SHIPROCKET_CAPABILITIES } from './client'

export const SHIPROCKET_BASE_URL = 'https://apiv2.shiprocket.in/v1/external'

/** Token refreshed a day before Shiprocket's 240h (10 day) expiry. */
const TOKEN_LIFETIME_MS = 240 * 60 * 60 * 1000
const TOKEN_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000

export type ShiprocketConfig = {
  /** The API user's email - created under Settings > API in Shiprocket, a
   *  separate login from the merchant's own dashboard account. */
  email: string
  password: string
  /** Registered pickup location nickname, exactly as on the Shiprocket dashboard. */
  pickupLocationName: string
  originPincode: string
  baseUrl?: string | undefined
  /** Shared secret Shiprocket lets you attach to a webhook's custom header
   *  (Settings > API > Webhooks), checked with a timing-safe comparison.
   *  Required: `parseWebhook` fails closed and rejects every call when this
   *  is not set, rather than accepting unauthenticated pushes. */
  webhookSecret?: string | undefined
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined
}

type LoginResponse = { token?: string; message?: string }

type ServiceableCourier = {
  courier_company_id?: number
  courier_name?: string
  cod?: number | string
  rate?: number | string
  freight_charge?: number | string
  /* Itemised parts of `rate`, read when present: the response schema is not published. */
  cod_charges?: number | string
  coverage_charges?: number | string
  other_charges?: number | string
  charge_weight?: number | string
  estimated_delivery_days?: string | number
  etd?: string
  is_surface?: boolean
}

const rupeesToPaise = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

/** The priced lines Shiprocket itemised for one courier; coverage is its insurance. */
function shiprocketCharges(c: ServiceableCourier): RateCharge[] {
  const lines: RateCharge[] = [
    { kind: 'freight', pricePaise: rupeesToPaise(c.freight_charge) },
    { kind: 'cod', pricePaise: rupeesToPaise(c.cod_charges) },
    { kind: 'insurance', pricePaise: rupeesToPaise(c.coverage_charges) },
    { kind: 'other', pricePaise: rupeesToPaise(c.other_charges) },
  ]
  return lines.filter((l) => l.pricePaise > 0)
}

type ServiceabilityResponse = {
  status?: number
  data?: { available_courier_companies?: ServiceableCourier[] }
}

type CreateOrderResponse = {
  order_id?: number
  shipment_id?: number
  status?: string
  message?: string
  status_code?: number
}

type AssignAwbResponse = {
  awb_assign_status?: number
  response?: {
    data?: { awb_code?: string; courier_name?: string; courier_company_id?: number }
  }
  message?: string
}

type LabelResponse = {
  label_created?: number
  label_url?: string
  response?: { label_url?: string }
}

type TrackScan = { date?: string; status?: string; activity?: string; location?: string }

type TrackActivity = {
  current_status?: string
  shipment_track_activities?: TrackScan[]
  etd?: string
  track_url?: string
}

type TrackResponse = Record<string, { tracking_data?: TrackActivity } | undefined>

type WalletResponse = { data?: { balance_amount?: number | string } }

type NdrResponse = { message?: string; ndr_raised?: boolean; error?: string }

/** `/orders/cancel/shipment/awbs`. Only `message` is documented; the rest is read when present. */
type CancelAwbResponse = {
  message?: string
  status_code?: number
  errors?: unknown
}

/**
 * Why a 2xx cancel answer is still a refusal, or null when it is not one. Shiprocket answers some
 * refusals with a 200 carrying `status_code` and `errors`, the way its create calls do.
 */
export function cancelRefusal(body: CancelAwbResponse | null | undefined): string | null {
  if (!body || typeof body !== 'object') return null
  const failed =
    (typeof body.status_code === 'number' && body.status_code >= 400) ||
    (body.errors !== undefined &&
      body.errors !== null &&
      !(Array.isArray(body.errors) && body.errors.length === 0) &&
      !(typeof body.errors === 'object' && Object.keys(body.errors).length === 0))
  if (!failed) return null
  if (body.message) return body.message
  if (typeof body.errors === 'string') return body.errors
  return 'no detail returned'
}

/**
 * Shiprocket's own status vocabulary (courier/track) is free text ("Pickup
 * Generated", "In Transit", "Out For Delivery", "Delivered", "RTO Initiated",
 * "Canceled" ...) rather than the coded fields Delhivery returns, so this
 * maps on substrings. Case-insensitive; falls back to `in_transit` for
 * anything unrecognised rather than guessing a terminal state.
 */
export function mapShiprocketStatus(status: string | undefined): ShipmentStatus {
  const text = (status ?? '').toLowerCase()
  if (text.includes('delivered')) return 'delivered'
  if (text.includes('rto') || text.includes('returned')) return 'rto'
  if (text.includes('cancel')) return 'cancelled'
  if (text.includes('out for delivery')) return 'out_for_delivery'
  if (text.includes('pickup generated') || text.includes('manifest') || text.includes('label'))
    return 'created'
  if (text.includes('picked up') || text.includes('pickup complete')) return 'picked_up'
  if (text.includes('transit') || text.includes('shipped') || text.includes('dispatch'))
    return 'in_transit'
  return 'in_transit'
}

export class ShiprocketProvider implements ShippingProvider {
  readonly id = 'shiprocket'
  readonly label = 'Shiprocket'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private token: string | undefined
  private tokenIssuedAt = 0

  constructor(private readonly config: ShiprocketConfig) {
    this.baseUrl = (config.baseUrl || SHIPROCKET_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  /** Logs in once, then reuses the token until it is a day from expiry. */
  private async authToken(): Promise<string> {
    const age = Date.now() - this.tokenIssuedAt
    if (this.token && age < TOKEN_LIFETIME_MS - TOKEN_REFRESH_MARGIN_MS) return this.token

    const res = await courierFetch(this.id, `${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: this.config.email, password: this.config.password }),
      fetchImpl: this.fetchImpl,
      timeoutMs: COURIER_TIMEOUT_MS,
    })
    const body = await courierJson<LoginResponse>(this.id, res)
    if (!body.token) {
      throw new CourierError('auth', this.id, body.message || 'Shiprocket did not return a token.')
    }
    this.token = body.token
    this.tokenIssuedAt = Date.now()
    return this.token
  }

  private async headers(extra: Record<string, string> = {}): Promise<Record<string, string>> {
    const token = await this.authToken()
    return { Authorization: `Bearer ${token}`, Accept: 'application/json', ...extra }
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      headers: await this.headers(),
      fetchImpl: this.fetchImpl,
    })
    return courierJson<T>(this.id, res)
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      method: 'POST',
      headers: await this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      fetchImpl: this.fetchImpl,
    })
    return courierJson<T>(this.id, res)
  }

  /** Shared by checkServiceability and quoteRate - one call answers both. */
  private async serviceability(query: {
    originPincode: string
    destinationPincode: string
    weightGrams?: number | null | undefined
    declaredValuePaise?: number | undefined
    cod?: boolean | undefined
  }): Promise<ServiceableCourier[]> {
    const weightKg = Math.max((query.weightGrams ?? 500) / 1000, 0.01).toFixed(2)
    const params = new URLSearchParams({
      pickup_postcode: query.originPincode,
      delivery_postcode: query.destinationPincode,
      weight: weightKg,
      cod: query.cod ? '1' : '0',
    })
    if (query.declaredValuePaise) {
      params.set('declared_value', String(Math.round(query.declaredValuePaise / 100)))
    }
    const data = await this.getJson<ServiceabilityResponse>(`/courier/serviceability/?${params}`)
    return data.data?.available_courier_companies ?? []
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const couriers = await this.serviceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      declaredValuePaise: query.declaredValue ? query.declaredValue * 100 : undefined,
    })
    if (couriers.length === 0) {
      return {
        provider: this.id,
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        minTransitDays: null,
        maxTransitDays: null,
        reason: 'No Shiprocket courier services this route.',
      }
    }
    const days = couriers
      .map((c) => Number(c.estimated_delivery_days))
      .filter((n) => Number.isFinite(n) && n > 0)
    return {
      provider: this.id,
      serviceable: true,
      /* Cash-on-delivery availability is per courier, not per route; true if
         any serviceable courier accepts COD. */
      codAvailable: couriers.some((c) => Number(c.cod) === 1 || c.cod === '1'),
      prepaidAvailable: true,
      minTransitDays: days.length ? Math.min(...days) : null,
      maxTransitDays: days.length ? Math.max(...days) : null,
      reason: null,
    }
  }

  /** The cheapest serviceable courier's price - one number for checkout's
   *  carrier-calculated-rate slot. The Shipments workspace's rate comparison
   *  calls `serviceability()` directly for the full per-courier list. */
  async quoteRate(query: RateQuery): Promise<RateQuote | null> {
    const couriers = await this.serviceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      declaredValuePaise: query.declaredValuePaise,
      cod: query.paymentMode === 'cod',
    })
    if (couriers.length === 0) return null
    const cheapest = couriers.reduce((min, c) => {
      const price = Number(c.rate ?? c.freight_charge)
      const minPrice = Number(min.rate ?? min.freight_charge)
      return Number.isFinite(price) && (!Number.isFinite(minPrice) || price < minPrice) ? c : min
    })
    const price = Number(cheapest.rate ?? cheapest.freight_charge)
    if (!Number.isFinite(price)) return null
    const days = Number(cheapest.estimated_delivery_days)
    return {
      pricePaise: Math.round(price * 100),
      minTransitDays: Number.isFinite(days) && days > 0 ? days : null,
      maxTransitDays: Number.isFinite(days) && days > 0 ? days : null,
    }
  }

  /** Every courier Shiprocket offers on the route, each bookable by its id (`serviceId`),
   *  with what Shiprocket itemised. The courier's name is the carrier the rate table shows
   *  as "Delhivery Surface (Shiprocket)". */
  async quoteOptions(query: RateQuery): Promise<RateOption[]> {
    const couriers = await this.serviceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      declaredValuePaise: query.declaredValuePaise,
      cod: query.paymentMode === 'cod',
    })
    return couriers.flatMap((c) => {
      const pricePaise = rupeesToPaise(c.rate ?? c.freight_charge)
      const id = String(c.courier_company_id ?? '')
      if (!id || !pricePaise) return []
      const days = Number(c.estimated_delivery_days)
      const weight = Number(c.charge_weight)
      const name = c.courier_name ?? 'Shiprocket courier'
      return [
        {
          serviceId: id,
          serviceLabel: name,
          carrier: name,
          pricePaise,
          minTransitDays: Number.isFinite(days) && days > 0 ? days : null,
          maxTransitDays: Number.isFinite(days) && days > 0 ? days : null,
          codAvailable: Number(c.cod) === 1 || c.cod === '1',
          charges: shiprocketCharges(c),
          // charge_weight is in kilograms.
          chargeableWeightGrams:
            Number.isFinite(weight) && weight > 0 ? Math.round(weight * 1000) : null,
        },
      ]
    })
  }

  buildOrderPayload(input: CreateShipmentInput) {
    const rupees = (paise: number) => Math.round(paise) / 100
    return {
      order_id: input.orderId,
      order_date: new Date().toISOString().slice(0, 19).replace('T', ' '),
      pickup_location: input.pickupLocationName || this.config.pickupLocationName,
      billing_customer_name: input.to.name,
      billing_last_name: '',
      billing_address: input.to.line1,
      billing_address_2: input.to.line2 ?? '',
      billing_city: input.to.city,
      billing_pincode: input.to.pincode,
      billing_state: input.to.state,
      billing_country: input.to.country || 'India',
      billing_email: 'orders@example.com',
      billing_phone: input.to.phone,
      shipping_is_billing: true,
      order_items: input.lines.map((l) => ({
        name: l.title.slice(0, 250),
        sku: l.title.slice(0, 50).replace(/\s+/g, '-').toLowerCase() || 'item',
        units: l.quantity,
        selling_price: rupees(l.unitPricePaise),
      })),
      payment_method: input.paymentMode === 'cod' ? 'COD' : 'Prepaid',
      sub_total: rupees(input.valuePaise),
      length: 10,
      breadth: 10,
      height: 10,
      weight: Math.max(input.weightGrams, 1) / 1000,
    }
  }

  /** The order lands in Shiprocket's Orders as "New", with no courier assigned yet. */
  async pushOrder(input: CreateShipmentInput): Promise<PushOrderResult> {
    const order = await this.createOrder(input)
    return {
      externalOrderId: String(order.order_id ?? input.orderId),
      externalShipmentId: String(order.shipment_id),
    }
  }

  /** `/orders/cancel` takes Shiprocket's own order ids, which `pushOrder` kept. */
  async cancelPushedOrder(pushed: PushOrderResult): Promise<void> {
    const id = Number(pushed.externalOrderId)
    if (!Number.isFinite(id)) {
      throw new CourierError('rejected', this.id, 'No Shiprocket order id to cancel.')
    }
    await this.postJson<unknown>('/orders/cancel', { ids: [id] })
  }

  private async createOrder(input: CreateShipmentInput) {
    const order = await this.postJson<CreateOrderResponse>(
      '/orders/create/adhoc',
      this.buildOrderPayload(input),
    )
    if (!order.shipment_id) {
      throw new CourierError(
        'rejected',
        this.id,
        `Shiprocket rejected the order: ${order.message || 'no detail returned'}`,
      )
    }
    return order
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    // Sent here earlier as a pending order: book that one, not a second copy.
    const order = input.pushed?.externalShipmentId
      ? { shipment_id: Number(input.pushed.externalShipmentId) }
      : await this.createOrder(input)

    /* The courier picked in the rate table (its courier_company_id), or none: Shiprocket
       then picks its recommended courier for the shipment. */
    const assign = await this.postJson<AssignAwbResponse>('/courier/assign/awb', {
      shipment_id: order.shipment_id,
      ...(input.serviceId ? { courier_id: Number(input.serviceId) } : {}),
    })
    const awb = assign.response?.data?.awb_code
    if (!awb) {
      throw new CourierError(
        'rejected',
        this.id,
        `Shiprocket did not assign an AWB: ${assign.message || 'no detail returned'}`,
      )
    }

    let labelUrl: string | undefined
    try {
      const label = await this.postJson<LabelResponse>('/courier/generate/label', {
        shipment_id: [order.shipment_id],
      })
      labelUrl = label.label_url || label.response?.label_url
    } catch {
      /* Label generation can fail independently of the booking (e.g. still
         processing); the shipment is real either way and the merchant can
         retry the label from the workspace. */
    }

    return { waybill: awb, providerRef: String(order.shipment_id), labelUrl }
  }

  /**
   * Return order payload for `POST /v1/external/orders/create/return`
   * ("Create a Return Order" in Shiprocket's official API collection,
   * postman.com/shiprocketdev). `pickup_*` is the shopper the courier collects
   * from, `shipping_*` is the warehouse it comes back to. Field names match
   * the published collection and the maintained SDK wrappers.
   */
  buildReturnPayload(input: ReturnPickupInput) {
    const rupees = (paise: number) => Math.round(paise) / 100
    return {
      order_id: input.reference,
      order_date: new Date().toISOString().slice(0, 10),
      pickup_customer_name: input.from.name,
      pickup_last_name: '',
      pickup_address: input.from.line1,
      pickup_address_2: input.from.line2 ?? '',
      pickup_city: input.from.city,
      pickup_state: input.from.state,
      pickup_country: 'India',
      pickup_pincode: input.from.pincode,
      pickup_email: 'orders@example.com',
      pickup_phone: input.from.phone,
      shipping_customer_name: input.to.name,
      shipping_last_name: '',
      shipping_address: input.to.line1,
      shipping_address_2: input.to.line2 ?? '',
      shipping_city: input.to.city,
      shipping_state: input.to.state,
      shipping_country: 'India',
      shipping_pincode: input.to.pincode,
      shipping_phone: input.to.phone,
      order_items: input.lines.map((l) => ({
        name: l.title.slice(0, 250),
        sku: l.title.slice(0, 50).replace(/\s+/g, '-').toLowerCase() || 'item',
        units: l.quantity,
        selling_price: rupees(l.unitPricePaise),
      })),
      payment_method: 'Prepaid',
      sub_total: rupees(input.valuePaise),
      length: 10,
      breadth: 10,
      height: 10,
      weight: Math.max(input.weightGrams, 1) / 1000,
    }
  }

  /**
   * Book a reverse pickup: create the return order, then ask for its AWB with
   * `is_return: 1` on `/courier/assign/awb`. The return-order endpoint is
   * confirmed by the official collection; the `is_return` flag on AWB
   * assignment is Shiprocket's documented way to get a return AWB but is not
   * yet confirmed against a live account (one SDK uses a separate
   * `/courier/assign/awb/return` path). If no AWB comes back the return order
   * still exists in Shiprocket and the merchant can assign it there, so this
   * throws with that instruction rather than guessing.
   */
  async createReturnPickup(input: ReturnPickupInput): Promise<CreateShipmentResult> {
    const order = await this.postJson<CreateOrderResponse>(
      '/orders/create/return',
      this.buildReturnPayload(input),
    )
    if (!order.shipment_id) {
      throw new CourierError(
        'rejected',
        this.id,
        `Shiprocket rejected the return: ${order.message || 'no detail returned'}`,
      )
    }
    const assign = await this.postJson<AssignAwbResponse>('/courier/assign/awb', {
      shipment_id: order.shipment_id,
      is_return: 1,
    })
    const awb = assign.response?.data?.awb_code
    if (!awb) {
      throw new CourierError(
        'rejected',
        this.id,
        `Shiprocket created the return but did not assign a courier: ${assign.message || 'assign one in Shiprocket under Returns'}`,
      )
    }
    return { waybill: awb, providerRef: String(order.shipment_id) }
  }

  async track(waybill: string): Promise<Tracking> {
    const data = await this.getJson<TrackResponse>(
      `/courier/track/awb/${encodeURIComponent(waybill)}`,
    )
    const entry = Object.values(data)[0]?.tracking_data
    if (!entry) {
      throw new CourierError('bad_response', this.id, 'Shiprocket has no record of this AWB.')
    }
    const events: TrackingEvent[] = (entry.shipment_track_activities ?? [])
      .map((s) => ({
        // India time with no offset; an unreadable date sorts first instead of failing the poll.
        at: courierTimeToIso(s.date) ?? new Date(0).toISOString(),
        status: mapShiprocketStatus(s.status),
        description: s.activity || s.status || '',
        location: s.location,
      }))
      .sort((a, b) => a.at.localeCompare(b.at))
    return {
      waybill,
      status: mapShiprocketStatus(entry.current_status),
      events,
      trackingUrl: entry.track_url,
      expectedDate: entry.etd?.slice(0, 10),
    }
  }

  /**
   * Cancel a booked shipment by AWB: `POST /orders/cancel/shipment/awbs` with `{ awbs: [...] }`
   * (Shiprocket's API collection, "Cancel a Shipment"). Core passes the stored shipment id
   * (`providerRef`) first, so the AWB comes from `ref.waybill`. The Shiprocket order itself stays
   * (it can be booked again there); `cancelPushedOrder` is the one that cancels a pending order.
   *
   * UNCONFIRMED LIVE: the success body is not documented beyond a message, so only a refusal the
   * API states (a 4xx, or a 2xx body with `status_code` >= 400 or `errors`) counts as failure.
   * Needs one live test on a test booking before it is relied on.
   */
  async cancel(waybillOrRef: string, ref?: CancelRef): Promise<void> {
    const awb = (ref?.waybill || waybillOrRef).trim()
    if (!awb) throw new CourierError('rejected', this.id, 'No AWB to cancel.')
    let result: CancelAwbResponse
    try {
      result = await this.postJson<CancelAwbResponse>('/orders/cancel/shipment/awbs', {
        awbs: [awb],
      })
    } catch (error) {
      // A 4xx other than auth and rate limits (which keep their kinds) is Shiprocket refusing
      // this cancel, e.g. the parcel was already picked up: say so in its own words.
      if (
        error instanceof CourierError &&
        error.kind === 'unavailable' &&
        error.status !== undefined &&
        error.status >= 400 &&
        error.status < 500
      ) {
        throw new CourierError(
          'rejected',
          this.id,
          `Shiprocket did not cancel AWB ${awb}: ${error.reason || `HTTP ${error.status}`}`,
          { status: error.status, reason: error.reason, cause: error },
        )
      }
      throw error
    }
    const refused = cancelRefusal(result)
    if (refused) {
      throw new CourierError('rejected', this.id, `Shiprocket did not cancel AWB ${awb}: ${refused}`, {
        reason: refused,
      })
    }
  }

  async schedulePickup(input: SchedulePickupInput): Promise<SchedulePickupResult> {
    void input
    throw new CourierError(
      'unavailable',
      this.id,
      'Shiprocket schedules pickup automatically per shipment via /courier/generate/pickup, keyed ' +
        'by shipment id, not a merchant-chosen date/location the way Delhivery is - not wired here.',
    )
  }

  /**
   * `/ndr/reattempt` (unofficial name, confirmed only via a third-party
   * Laravel SDK, never seen in Shiprocket's own rendered docs). Accepts an
   * AWB plus optional address1/address2/phone for a change-of-address and
   * deferred_date for a specific reattempt date, so both `reattempt` and
   * `change_address` map to this one endpoint. `rto` has no known equivalent
   * and is rejected outright rather than guessed at.
   */
  async ndrAction(input: NdrActionInput): Promise<NdrActionResult> {
    if (input.action === 'rto') {
      throw new CourierError(
        'unavailable',
        this.id,
        'Shiprocket has no confirmed API to force an RTO from here; use the Shiprocket dashboard.',
      )
    }
    const body: Record<string, string> = { awb: input.waybill }
    if (input.address) body.address1 = input.address
    if (input.phone) body.phone = input.phone
    if (input.deferredDate) body.deferred_date = input.deferredDate
    if (input.comment) body.comments = input.comment
    const result = await this.postJson<NdrResponse>('/ndr/reattempt', body)
    if (result.error) {
      throw new CourierError('rejected', this.id, result.error)
    }
    return { accepted: true }
  }

  async getWalletBalance(): Promise<WalletBalance> {
    const data = await this.getJson<WalletResponse>('/account/details/wallet-balance')
    const balance = Number(data.data?.balance_amount)
    if (!Number.isFinite(balance)) {
      throw new CourierError('bad_response', this.id, 'Shiprocket did not return a wallet balance.')
    }
    return { balancePaise: Math.round(balance * 100), asOf: new Date().toISOString() }
  }

  /**
   * Shiprocket's webhook payload docs were not fetchable from this
   * environment; this follows the same shared-secret pattern as Delhivery -
   * the merchant pastes the same value into both places when registering the
   * webhook (Settings > API > Webhooks, "custom header"). We only extract the
   * AWB and re-fetch full tracking via `track()`, so a body shape we did not
   * anticipate still degrades safely (skipped, not mis-parsed).
   */
  async parseWebhook(request: WebhookRequest): Promise<WebhookNotice[]> {
    // Fail closed: no configured secret means we cannot tell a genuine call
    // from a stray one, so every webhook is refused until one is set (the
    // Connect page marks it required for automatic tracking).
    if (!this.config.webhookSecret) {
      logger.error('webhook refused: no webhookSecret configured', { provider: 'shiprocket' })
      throw new CourierError('auth', this.id, 'Shiprocket webhook secret is not configured.')
    }
    // Shiprocket's webhook form ("Token") sends the value in `x-api-key`; the other two stay
    // accepted for webhooks registered before this.
    const got =
      request.headers['x-api-key'] ??
      request.headers['x-webhook-token'] ??
      request.headers.authorization ??
      ''
    if (!timingSafeEqualString(got, this.config.webhookSecret)) {
      throw new CourierError('auth', this.id, 'Shiprocket webhook token did not match.')
    }
    let body: unknown
    try {
      body = JSON.parse(request.rawBody)
    } catch (error) {
      throw new CourierError('bad_response', this.id, 'Shiprocket webhook body was not JSON.', {
        cause: error,
      })
    }
    const items = Array.isArray(body) ? body : [body]
    const notices: WebhookNotice[] = []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const r = item as Record<string, unknown>
      const awb = r.awb ?? r.awb_code ?? r.AWB
      if (typeof awb !== 'string' || !awb) continue
      // eventId is AWB + status + the scan's own timestamp from the payload,
      // never `Date.now()` (the server's clock, which would mint a fresh id
      // on every retry of the same scan and defeat de-duplication) and never
      // the timestamp alone (an unrelated payload field could otherwise be
      // varied to spam "new" events for the same AWB). This does not
      // cryptographically authenticate the scan — only the shared secret
      // above does that — it just keeps a replay of the same scan from
      // being treated as a new one.
      const status = r.current_status ?? r.status ?? ''
      const stamp = r.current_timestamp ?? r.updated_at ?? ''
      notices.push({ waybill: awb, eventId: `${awb}:${status}:${stamp}` })
    }
    return notices
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.authToken()
      return { ok: true, message: `Connected to Shiprocket at ${this.baseUrl}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            "Shiprocket rejected the email/password. Check these are the API user's credentials " +
            '(Settings > API in Shiprocket) - a separate login from the merchant dashboard account.',
        }
      }
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not verify Shiprocket credentials.',
      }
    }
  }
}

const fields: ProviderField[] = [
  {
    key: 'email',
    label: 'API user email',
    required: true,
    help: "The API user's email from Shiprocket Settings > API - not the dashboard login.",
  },
  { key: 'password', label: 'API user password', secret: true, required: true },
  {
    key: 'pickupLocationName',
    label: 'Pickup location nickname',
    required: true,
    help: 'The registered pickup location nickname, spelled exactly as on the Shiprocket dashboard.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  {
    key: 'baseUrl',
    label: 'API base URL',
    help: 'Leave blank for production.',
  },
  {
    key: 'webhookSecret',
    label: 'Webhook shared secret',
    secret: true,
    help:
      'Required for automatic tracking updates via webhook (a webhook call without it is refused). ' +
      'Paste the same value into the Token field when registering the tracking ' +
      'webhook in Shiprocket (Settings > API > Webhooks), so we can tell a genuine call from a stray one.',
  },
]

export const shiprocketFactory: ShippingProviderFactory<ShiprocketConfig> = {
  id: 'shiprocket',
  label: 'Shiprocket',
  fields,
  capabilities: SHIPROCKET_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
      errors.push('a valid API user email is required')
    }
    if (!r.password?.trim()) errors.push('password is required')
    if (!r.pickupLocationName?.trim()) errors.push('pickup location nickname is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    const baseUrlProblem = courierBaseUrlProblem(r.baseUrl, ['shiprocket.in'])
    if (baseUrlProblem) errors.push(baseUrlProblem)
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        email: (r.email as string).trim(),
        password: r.password as string,
        pickupLocationName: (r.pickupLocationName as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        baseUrl: r.baseUrl?.trim() || undefined,
        webhookSecret: r.webhookSecret?.trim() || undefined,
      },
    }
  },
  create: (config) => new ShiprocketProvider(config),
}
