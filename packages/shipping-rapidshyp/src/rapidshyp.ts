/**
 * RapidShyp adapter - an Indian multi-courier aggregator (rapidshyp.com),
 * same shape of integration as Shiprocket: one account, many underlying
 * couriers, a single "serviceability" call answers both "can you deliver
 * here" and "what would it cost".
 *
 * RapidShyp's docs site (docs.rapidshyp.com) renders as a client-side app
 * shell that this environment could not fetch when packages/shipping-rapidshyp
 * first shipped (#163) - only the three endpoints below were readable then.
 * The full docs were later saved to a local file and read end to end; every
 * endpoint this file calls is confirmed against that text (request/response
 * shapes and sample payloads, not a live account). Base URL
 * `https://api.rapidshyp.com`, header `rapidshyp-token: <API key>` (a static
 * per-account key from the RapidShyp dashboard, not a login/session token
 * like Shiprocket's - so there is no token-refresh cycle here).
 *
 * VERIFIED AGAINST DOCS (docs.rapidshyp.com/docs/DocumentationSidebar/...):
 *
 *   POST /rapidshyp/apis/v1/serviceabilty_check   rate + ETA per courier; `is_return` flag
 *        for return-leg serviceability (.../Pincode%20Serviceability%20API/...)
 *   POST /rapidshyp/apis/v1/wrapper                create order + assign AWB + label + pickup,
 *        one call, one fully-specified response shape (.../Wrapper/B2C%20Wrapper%20API)
 *   POST /rapidshyp/apis/v1/assign_awb              assign/reassign AWB by shipment id
 *        (.../Forward%20B2C/Shipments/POST%20Assign%20AWB)
 *   POST /rapidshyp/apis/v1/schedule_pickup         schedule pickup for one shipment+AWB
 *        (.../Forward%20B2C/Shipments/POST%20Schedule%20Pickup)
 *   GET  /rapidshyp/apis/v1/generate_label          label PDF by shipment id
 *        (.../Forward%20B2C/Shipments/GET%20Label%20PDF)
 *   POST /rapidshyp/apis/v1/cancel_order            cancel by RapidShyp's own order id
 *        (.../Forward%20B2C/Orders/POST%20Cancel%20Order)
 *   POST /rapidshyp/apis/v1/track_order             B2C tracking by AWB or order id
 *        (.../Tracking/B2C%20Tracking%20API)
 *   POST /rapidshyp/apis/v1/ndr/action              reattempt / return a pending NDR
 *        (.../Forward%20B2C/Shipments/POST%20NDR%20Action)
 *   POST /rapidshyp/apis/v1/create_return           create a return (reverse) order
 *        (.../Return%20API/POST%20Create%20Return%20Order)
 *   POST /rapidshyp/apis/v1/return_schedule_pickup  assign a reverse-pickup courier + AWB
 *        (.../Return%20API/POST%20Schedule%20Pickup)
 *   GET  /rapidshyp/apis/v1/fetch_pickup_location   list registered pickup locations
 *        (.../Pickup%20Location/GET%20Pickup%20Location)
 *   POST /rapidshyp/apis/v1/create/pickup_location  register a new pickup location
 *        (.../Pickup%20Location/POST%20Create%20Pickup%20Location)
 *
 * WHY /wrapper INSTEAD OF /create_order FOR createShipment: the plain Create
 * Order API's own response is documented only as `{ status, remarks, order_id,
 * shipment: [] }` with no field-level detail inside `shipment` ("structure not
 * detailed" - the reason this file used to stop after create_order and guess).
 * The Wrapper API takes the same order fields and chains create + assign AWB +
 * generate label + schedule pickup server-side, and its response sample is
 * fully specified (`awbGenerated`, `awb`, `labelURL`, `pickupScheduled`,
 * `shipmentId`, `orderId`, ...). Using the one call with a confirmed shape
 * beats guessing at the shorter call's unconfirmed one. `assignAwb`,
 * `schedulePickupForShipment` and `generateLabel` are still implemented and
 * used as best-effort fallbacks when the wrapper's own attempt at any of
 * those three sub-steps did not succeed.
 *
 * NOT IMPLEMENTED:
 *  - Approve Order (`/approve_orders`) - RapidShyp's own docs describe orders
 *    as shippable once created; nothing here depends on a separate approval
 *    step, and no account-specific "approval required" setting could be
 *    confirmed, so this is left out rather than called unconditionally.
 *  - De-allocate Shipment (`/de_allocate_shipment`) - frees an AWB for
 *    re-assignment to a different courier without cancelling the order; a
 *    different operation from `cancel()` (which must actually stop the
 *    shipment), so it is not used as a cancel path. Nothing in the shared
 *    contract calls for "unassign this AWB" today.
 *  - Webhooks: no webhook payload or signature scheme is documented anywhere
 *    in RapidShyp's docs. `track()` is real and confirmed, so the tracking
 *    job's regular poll (packages/core/src/shipping - `listOpenShipments`)
 *    is how this store learns about scans; there is no `parseWebhook` here.
 *  - Wallet balance: no endpoint documented. Left manual, per the PR.
 *  - Update Pickup Location: the docs page for it is a literal "Coming
 *    Soon....." placeholder.
 */

import {
  COURIER_TIMEOUT_MS,
  CourierError,
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
  type RateOption,
  type RateQuery,
  type RateQuote,
  type ReturnPickupInput,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
} from '@commerce/shipping'
import { RAPIDSHYP_CAPABILITIES } from './client'
import { eddDaysFromToday } from './edd'
import { mapRapidshypStatus } from './status'

export const RAPIDSHYP_BASE_URL = 'https://api.rapidshyp.com'

export type RapidshypConfig = {
  /** Static per-account key from the RapidShyp dashboard (Settings > API), sent as
   *  the `rapidshyp-token` header on every call - no login step, unlike Shiprocket. */
  apiKey: string
  /** `storeName` on `create_order`/`cancel_order`; RapidShyp's docs say to use
   *  the literal string "DEFAULT" for a single sales channel. */
  storeName: string
  /** Registered pickup location name, exactly as on the RapidShyp dashboard. */
  pickupAddressName: string
  originPincode: string
  baseUrl?: string | undefined
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined
}

type ServiceableCourier = {
  courier_code?: string
  courier_name?: string
  parent_courier_name?: string
  total_freight?: number | string
  edd?: string
  epd?: string
  min_weight?: number | string
  max_weight?: number | string
}

type ServiceabilityResponse = {
  status?: boolean
  remark?: string
  serviceable_courier_list?: ServiceableCourier[]
}

type WrapperShipment = {
  shipmentId?: string | number
  awbGenerated?: boolean
  labelGenerated?: boolean
  pickupScheduled?: boolean
  awb?: string
  courierCode?: string
  courierName?: string
  labelURL?: string
  manifestURL?: string
}

type WrapperResponse = {
  status?: string
  remarks?: string
  orderId?: string
  orderCreated?: boolean
  shipment?: WrapperShipment[]
}

type CreateOrderOnlyResponse = {
  status?: string
  remarks?: string
  order_id?: string
  shipment?: { shipmentId?: string | number; shipment_id?: string | number }[]
}

type AssignAwbResponse = {
  status?: string
  remarks?: string
  shipment_id?: string
  order_id?: string
  awb?: string
  courier_code?: string
  courier_name?: string
}

type SchedulePickupResponse = {
  status?: string
  remarks?: string
  shipmentId?: string
  orderId?: string
  awb?: string
  courierCode?: string
  courierName?: string
}

type LabelResponse = {
  status?: boolean
  remarks?: string
  labelData?: Array<{ shipmentId?: string; labelURL?: string; labelRemarks?: string }>
}

type CancelOrderResponse = { status?: boolean; remarks?: string }

type NdrActionResponse = { status?: string; remarks?: string }

type ReturnOrderResponse = {
  status?: string
  remark?: string
  order_id?: string
  shipment?: Array<{ shipment_id?: string }>
}

type ReturnScheduleResponse = {
  status?: string
  remarks?: string
  shipmentId?: string
  orderId?: string
  awb?: string
  courierCode?: string
}

type TrackShipmentDetail = {
  shipment_id?: string
  awb?: string
  shipment_status?: string
  current_tracking_status_code?: string | null
  current_tracking_status_desc?: string | null
  current_status_date?: string | null
  current_courier_edd?: string | null
  track_scans?: Array<{
    status_code?: string
    status_description?: string
    date?: string
    location?: string
  }> | null
}

type TrackOrderResponse = {
  success?: boolean
  msg?: string
  records?: Array<{ shipment_details?: TrackShipmentDetail[] }>
}

type PickupLocation = {
  pickup_name?: string
  contact_name?: string
  contact_number?: string
  contact_email?: string
  pickup_address_1?: string
  pickup_address_2?: string
  city?: string
  state?: string
  pin_code?: string
  country?: string
  status?: string
  is_rto_address_same?: boolean
}

export class RapidshypProvider implements ShippingProvider {
  readonly id = 'rapidshyp'
  readonly label = 'RapidShyp'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  /**
   * Serviceability calls in flight, by request body. Checkout asks prepaid rates, COD rates and
   * serviceability at once, and each of those used to post the same body again: six calls, two
   * of them one after the other, about 1.8–2 s in all (#1524). Identical asks now share one call.
   */
  private readonly inflight = new Map<string, Promise<ServiceableCourier[]>>()

  constructor(private readonly config: RapidshypConfig) {
    this.baseUrl = (config.baseUrl || RAPIDSHYP_BASE_URL).replace(/\/+$/, '')
    this.fetchImpl = config.fetchImpl ?? fetch
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'rapidshyp-token': this.config.apiKey,
    }
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      fetchImpl: this.fetchImpl,
      timeoutMs: COURIER_TIMEOUT_MS,
    })
    return courierJson<T>(this.id, res)
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await courierFetch(this.id, `${this.baseUrl}${path}`, {
      headers: this.headers(),
      fetchImpl: this.fetchImpl,
      timeoutMs: COURIER_TIMEOUT_MS,
    })
    return courierJson<T>(this.id, res)
  }

  /** Shared by checkServiceability, quoteRate, quoteOptions and createReturnPickup -
   *  one call answers all four (`is_return` switches to the return-leg network). */
  private async serviceability(query: {
    originPincode: string
    destinationPincode: string
    weightGrams?: number | null | undefined
    declaredValue?: number | undefined
    cod?: boolean | undefined
    isReturn?: boolean | undefined
  }): Promise<ServiceableCourier[]> {
    const weightKg = Math.max((query.weightGrams ?? 500) / 1000, 0.01)
    const body = {
      Pickup_pincode: query.originPincode,
      Delivery_pincode: query.destinationPincode,
      cod: Boolean(query.cod),
      // Whole rupees, so checkout's serviceability and rate asks post the same body.
      total_order_value: Math.round(query.declaredValue ?? 0),
      weight: weightKg,
      ...(query.isReturn ? { is_return: true } : {}),
    }
    const key = JSON.stringify(body)
    const running = this.inflight.get(key)
    if (running) return running
    const call = this.postJson<ServiceabilityResponse>(
      '/rapidshyp/apis/v1/serviceabilty_check',
      body,
    )
      .then((data) => data.serviceable_courier_list ?? [])
      .finally(() => this.inflight.delete(key))
    this.inflight.set(key, call)
    return call
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const ask = (cod: boolean) =>
      this.serviceability({
        originPincode: query.originPincode,
        destinationPincode: query.destinationPincode,
        weightGrams: query.weightGrams,
        declaredValue: query.declaredValue ?? undefined,
        cod,
      })
    /* RapidShyp's serviceability response has no per-courier COD flag in the
       documented fields; a second call with cod:true is the only confirmed
       way to learn COD availability, so this checks it as a real call rather
       than guessing. Both run at once (they used to run one after the other). */
    const [couriers, cod] = await Promise.all([
      ask(false),
      ask(true).then(
        (list) => ({ ok: true as const, list }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    ])
    if (couriers.length === 0) {
      return {
        provider: this.id,
        serviceable: false,
        codAvailable: false,
        prepaidAvailable: false,
        minTransitDays: null,
        maxTransitDays: null,
        reason: 'No RapidShyp courier services this route.',
      }
    }
    if (!cod.ok) throw cod.error
    const codCouriers = cod.list
    const days = couriers.map((c) => eddDaysFromToday(c.edd)).filter((n): n is number => n !== null)
    return {
      provider: this.id,
      serviceable: true,
      codAvailable: codCouriers.length > 0,
      prepaidAvailable: true,
      minTransitDays: days.length ? Math.min(...days) : null,
      maxTransitDays: days.length ? Math.max(...days) : null,
      reason: null,
    }
  }

  /** The cheapest serviceable courier's price - one number for checkout's
   *  carrier-calculated-rate slot. */
  async quoteRate(query: RateQuery): Promise<RateQuote | null> {
    const couriers = await this.serviceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      declaredValue: query.declaredValuePaise ? query.declaredValuePaise / 100 : undefined,
      cod: query.paymentMode === 'cod',
    })
    if (couriers.length === 0) return null
    const cheapest = couriers.reduce((min, c) => {
      const price = Number(c.total_freight)
      const minPrice = Number(min.total_freight)
      return Number.isFinite(price) && (!Number.isFinite(minPrice) || price < minPrice) ? c : min
    })
    const price = Number(cheapest.total_freight)
    if (!Number.isFinite(price)) return null
    const days = eddDaysFromToday(cheapest.edd)
    return { pricePaise: Math.round(price * 100), minTransitDays: days, maxTransitDays: days }
  }

  /** Every courier RapidShyp offers on the route, each bookable by its code (`serviceId`).
   *  RapidShyp answers with one total per courier, so no itemised charges. The COD list is
   *  a second call: a courier missing from it does not collect cash. */
  async quoteOptions(query: RateQuery): Promise<RateOption[]> {
    const [couriers, codCouriers] = await Promise.all([
      this.serviceability({
        originPincode: query.originPincode,
        destinationPincode: query.destinationPincode,
        weightGrams: query.weightGrams,
        declaredValue: query.declaredValuePaise / 100,
        cod: query.paymentMode === 'cod',
      }),
      this.serviceability({
        originPincode: query.originPincode,
        destinationPincode: query.destinationPincode,
        weightGrams: query.weightGrams,
        declaredValue: query.declaredValuePaise / 100,
        cod: true,
      }),
    ])
    const codCodes = new Set(codCouriers.map((c) => c.courier_code))
    return couriers.flatMap((c) => {
      const price = Number(c.total_freight)
      if (!c.courier_code || !Number.isFinite(price) || price <= 0) return []
      const days = eddDaysFromToday(c.edd)
      const name = c.courier_name ?? 'RapidShyp courier'
      return [
        {
          serviceId: c.courier_code,
          serviceLabel: name,
          carrier: c.parent_courier_name || name,
          pricePaise: Math.round(price * 100),
          minTransitDays: days,
          maxTransitDays: days,
          codAvailable: codCodes.has(c.courier_code),
          charges: [],
          chargeableWeightGrams: null,
        },
      ]
    })
  }

  buildOrderPayload(input: CreateShipmentInput) {
    return {
      orderId: input.orderId,
      orderDate: new Date().toISOString().slice(0, 10),
      storeName: this.config.storeName,
      billingIsShipping: true,
      pickupAddressName: this.config.pickupAddressName,
      shippingAddress: {
        firstName: input.to.name,
        addressLine1: input.to.line1,
        addressLine2: input.to.line2 ?? '',
        pinCode: input.to.pincode,
        phone: input.to.phone,
      },
      orderItems: input.lines.map((l) => ({
        itemName: l.title.slice(0, 250),
        units: l.quantity,
        unitPrice: Math.round(l.unitPricePaise) / 100,
        tax: 0,
      })),
      paymentMethod: input.paymentMode === 'cod' ? 'COD' : 'PREPAID',
      packageDetails: {
        packageLength: 10,
        packageBreadth: 10,
        packageHeight: 10,
        packageWeight: Math.max(input.weightGrams, 1),
      },
    }
  }

  /** Assign AWB API - explicit fallback for when a create call did not come back with one. */
  async assignAwb(shipmentId: string, courierCode?: string): Promise<{ awb: string }> {
    const result = await this.postJson<AssignAwbResponse>('/rapidshyp/apis/v1/assign_awb', {
      shipment_id: shipmentId,
      courier_code: courierCode ?? '',
    })
    if (!result.awb) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp did not assign an AWB: ${result.remarks || 'no detail returned'}`,
      )
    }
    return { awb: result.awb }
  }

  /** Schedule Pickup API - best-effort, per shipment; swallowed by callers that already have a
   *  shipment booked, since a pickup failing here never invalidates the booking itself. */
  private async schedulePickupForShipment(
    shipmentId: string,
    awb: string,
  ): Promise<SchedulePickupResponse> {
    return this.postJson<SchedulePickupResponse>('/rapidshyp/apis/v1/schedule_pickup', {
      shipment_id: shipmentId,
      awb,
    })
  }

  /** Label PDF API - explicit fallback for when a create call did not come back with a label. */
  async generateLabel(shipmentIds: string[]): Promise<string | undefined> {
    const result = await this.postJson<LabelResponse>('/rapidshyp/apis/v1/generate_label', {
      shipmentId: shipmentIds,
    })
    return result.labelData?.[0]?.labelURL
  }

  /**
   * Create Order only: the order shows in RapidShyp's panel without an AWB. Its response is
   * documented as `{ status, remarks, order_id, shipment: [] }`; the shipment id is read when
   * present, and booking later falls back to the order id we sent.
   */
  async pushOrder(input: CreateShipmentInput): Promise<PushOrderResult> {
    const r = await this.postJson<CreateOrderOnlyResponse>(
      '/rapidshyp/apis/v1/create_order',
      this.buildOrderPayload(input),
    )
    const shipment = r.shipment?.[0]
    const shipmentId = shipment?.shipmentId ?? shipment?.shipment_id
    if (!r.order_id && !shipmentId) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp rejected the order: ${r.remarks || 'no detail returned'}`,
      )
    }
    return {
      externalOrderId: String(r.order_id ?? input.orderId),
      externalShipmentId: shipmentId != null ? String(shipmentId) : undefined,
    }
  }

  /** The pending order goes the same way as a booked one: `cancel_order` by order id. */
  async cancelPushedOrder(pushed: PushOrderResult): Promise<void> {
    await this.cancel(pushed.externalOrderId)
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const pushedShipment = input.pushed?.externalShipmentId
    // Sent here earlier as a pending order: assign a courier to that shipment instead.
    const order: WrapperResponse = pushedShipment
      ? {
          orderCreated: true,
          orderId: input.pushed?.externalOrderId ?? input.orderId,
          shipment: [{ shipmentId: pushedShipment }],
        }
      : await this.postJson<WrapperResponse>(
          '/rapidshyp/apis/v1/wrapper',
          this.buildOrderPayload(input),
        )
    if (!order.orderCreated) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp rejected the order: ${order.remarks || 'no detail returned'}`,
      )
    }
    const first = order.shipment?.[0]
    const shipmentId = first?.shipmentId != null ? String(first.shipmentId) : undefined
    if (!shipmentId) {
      throw new CourierError(
        'bad_response',
        this.id,
        'RapidShyp created the order but returned no shipment id.',
      )
    }

    let awb = first?.awb
    let labelUrl = first?.labelURL
    let pickupScheduled = first?.pickupScheduled === true
    /* The wrapper books by the account's courier priority. When the merchant picked another
       courier in the rate table, reassign the shipment to it (assign_awb reassigns by
       shipment id); the label and pickup then follow the new AWB. */
    if (awb && input.serviceId && first?.courierCode && first.courierCode !== input.serviceId) {
      const reassigned = await this.assignAwb(shipmentId, input.serviceId)
      awb = reassigned.awb
      labelUrl = undefined
      pickupScheduled = false
    }
    if (!awb) {
      // The wrapper's own AWB assignment did not come back with one (e.g. no
      // courier matched its rule/priority) - one explicit retry, letting
      // RapidShyp pick the default courier again.
      const assigned = await this.assignAwb(shipmentId, input.serviceId).catch(() => null)
      awb = assigned?.awb
    }
    if (!awb) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp created shipment ${shipmentId} but could not assign a courier: ${order.remarks || 'no detail returned'}`,
      )
    }

    if (!pickupScheduled) {
      // Best-effort: pickup failing here never invalidates the booking - the
      // merchant can retry it from the Shipments workspace's pickup tab.
      await this.schedulePickupForShipment(shipmentId, awb).catch(() => undefined)
    }
    if (!labelUrl) {
      labelUrl = await this.generateLabel([shipmentId]).catch(() => undefined)
    }

    return {
      waybill: awb,
      // cancel_order takes RapidShyp's own order id, echoed back here (falls back to the seller
      // orderId we sent, which RapidShyp's docs say coincide for the "DEFAULT" store/channel).
      providerRef: order.orderId || input.orderId,
      labelUrl,
    }
  }

  /** B2C Tracking API. Looks the AWB up directly - no order id needed. */
  async track(waybill: string): Promise<Tracking> {
    const data = await this.postJson<TrackOrderResponse>('/rapidshyp/apis/v1/track_order', {
      awb: waybill,
    })
    const detail = data.records
      ?.flatMap((r) => r.shipment_details ?? [])
      .find((d) => !d.awb || d.awb === waybill)
    if (!data.success || !detail) {
      throw new CourierError('bad_response', this.id, 'RapidShyp has no record of this AWB.')
    }

    const status = mapRapidshypStatus(detail.current_tracking_status_code, detail.shipment_status)
    const scans = detail.track_scans ?? []
    const events: TrackingEvent[] = scans.length
      ? scans.map((s) => ({
          // India time with no offset, either date order; unreadable sorts first, never throws.
          at: courierTimeToIso(s.date) ?? new Date(0).toISOString(),
          status: mapRapidshypStatus(s.status_code, detail.shipment_status),
          description: s.status_description || s.status_code || '',
          location: s.location,
        }))
      : [
          {
            at: courierTimeToIso(detail.current_status_date) ?? new Date().toISOString(),
            status,
            description: detail.current_tracking_status_desc || detail.shipment_status || '',
          },
        ]
    events.sort((a, b) => a.at.localeCompare(b.at))

    return {
      waybill,
      status,
      events,
      expectedDate: detail.current_courier_edd?.slice(0, 10) ?? undefined,
    }
  }

  /**
   * Cancel Order API. Takes RapidShyp's own order id (`providerRef` on the
   * shared shipment record, set from `createShipment`'s wrapper response),
   * not the AWB - `packages/core/src/shipping/shipments.ts` passes
   * `providerRef || waybill`, so an older shipment booked before that field
   * existed still gets a best-effort attempt with the waybill.
   *
   * De-allocate Shipment (`/de_allocate_shipment`) was considered for this
   * instead: it only frees the AWB for a different courier and does not stop
   * the order, so it is not a substitute for cancel and is left unused.
   */
  async cancel(orderIdOrWaybill: string): Promise<void> {
    const result = await this.postJson<CancelOrderResponse>('/rapidshyp/apis/v1/cancel_order', {
      orderId: orderIdOrWaybill,
      storeName: this.config.storeName,
    })
    if (!result.status) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp did not cancel the order: ${result.remarks || 'no detail returned'}`,
      )
    }
  }

  /**
   * NDR Action API. `action` values per the docs' request-parameter table
   * ("RE_ATTEMPT" / "RETURN") do not match its own curl sample ("REATTEMPT",
   * no underscore); this follows the sample literally since it is the one
   * value shown actually sent on the wire, and should be revisited if a live
   * account rejects it. `change_address` reuses the reattempt action with the
   * updated address, same as Shiprocket's and Delhivery's own change-of-address
   * mapping - RapidShyp's NDR API has no separate action for it.
   */
  async ndrAction(input: NdrActionInput): Promise<NdrActionResult> {
    const body: Record<string, string> = {
      awb: input.waybill,
      action: input.action === 'rto' ? 'RETURN' : 'REATTEMPT',
    }
    if (input.phone) body.phone = input.phone
    if (input.address) body.address1 = input.address
    const result = await this.postJson<NdrActionResponse>('/rapidshyp/apis/v1/ndr/action', body)
    const ok = String(result.status).toUpperCase() === 'SUCCESS'
    if (!ok) {
      throw new CourierError(
        'rejected',
        this.id,
        result.remarks || 'RapidShyp rejected the NDR action.',
      )
    }
    return { accepted: true }
  }

  /**
   * Reverse pickup: Return Pincode Serviceability (to pick a courier) ->
   * Create Return Order -> Return Schedule Pickup (assigns the courier and
   * returns the AWB). Mirrors how `packages/shipping-shiprocket` books a
   * return: create, then a second call to actually get an AWB.
   */
  async createReturnPickup(input: ReturnPickupInput): Promise<CreateShipmentResult> {
    const couriers = await this.serviceability({
      originPincode: input.from.pincode,
      destinationPincode: input.to.pincode,
      weightGrams: input.weightGrams,
      declaredValue: input.valuePaise / 100,
      isReturn: true,
    })
    const courierCode = couriers[0]?.courier_code
    if (!courierCode) {
      throw new CourierError(
        'rejected',
        this.id,
        'No RapidShyp courier can collect this return on this route.',
      )
    }

    const order = await this.postJson<ReturnOrderResponse>('/rapidshyp/apis/v1/create_return', {
      orderId: input.reference,
      orderDate: new Date().toISOString().slice(0, 10),
      pickupLocation: {
        pickup_customer_name: input.from.name,
        pickup_phone: input.from.phone,
        pickup_address: input.from.line1,
        pickup_address_2: input.from.line2 ?? '',
        pickup_pincode: input.from.pincode,
      },
      storeName: this.config.storeName,
      deliveryAddress_name: this.config.pickupAddressName,
      orderItems: input.lines.map((l) => ({
        itemName: l.title.slice(0, 250),
        units: l.quantity,
        unitPrice: Math.round(l.unitPricePaise) / 100,
        tax: 0,
      })),
      packageDetails: {
        packageLength: 10,
        packageBreadth: 10,
        packageHeight: 10,
        packageWeight: Math.max(input.weightGrams, 1),
      },
    })
    const shipmentId = order.shipment?.[0]?.shipment_id
    if (!shipmentId) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp rejected the return: ${order.remark || 'no detail returned'}`,
      )
    }

    const scheduled = await this.postJson<ReturnScheduleResponse>(
      '/rapidshyp/apis/v1/return_schedule_pickup',
      { shipment_id: shipmentId, courier_code: courierCode },
    )
    if (!scheduled.awb) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp created return shipment ${shipmentId} but did not assign a courier: ${scheduled.remarks || 'no detail returned'}`,
      )
    }
    return { waybill: scheduled.awb, providerRef: shipmentId }
  }

  /**
   * Fetch Pickup Location API - used by the Connect page's "Test connection"
   * to offer a dropdown of the merchant's already-registered pickup
   * locations instead of a free-text nickname that must match exactly. Not
   * part of the shared `ShippingProvider` contract (no other courier here
   * exposes an equivalent lookup); called directly by
   * `testShippingConnection`, same pattern as `quoteOptions`.
   */
  async listPickupLocations(): Promise<
    Array<{
      name: string
      city: string | undefined
      pincode: string | undefined
      status: string | undefined
    }>
  > {
    const data = await this.getJson<PickupLocation | PickupLocation[]>(
      '/rapidshyp/apis/v1/fetch_pickup_location',
    )
    const list = Array.isArray(data) ? data : [data]
    return list
      .filter((l) => l.pickup_name)
      .map((l) => ({
        name: l.pickup_name as string,
        city: l.city,
        pincode: l.pin_code,
        status: l.status,
      }))
  }

  /** Create Pickup Location API - not yet wired to a "register a new location" UI action;
   *  implemented so the Connect page can add one later without a second round of doc-reading. */
  async createPickupLocation(input: {
    addressName: string
    contactName: string
    contactNumber: string
    email?: string
    addressLine1: string
    addressLine2?: string
    pincode: string
    gstin?: string
  }): Promise<{ pickupLocationName: string }> {
    const result = await this.postJson<{
      status?: string
      remark?: string
      pickup_location_name?: string
    }>('/rapidshyp/apis/v1/create/pickup_location', {
      address_name: input.addressName,
      contact_name: input.contactName,
      contact_number: input.contactNumber,
      email: input.email ?? '',
      address_line: input.addressLine1,
      address_line2: input.addressLine2 ?? '',
      pincode: input.pincode,
      gstin: input.gstin ?? '',
      use_alt_rto_address: false,
    })
    if (!result.pickup_location_name) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp did not create the pickup location: ${result.remark || 'no detail returned'}`,
      )
    }
    return { pickupLocationName: result.pickup_location_name }
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.postJson<ServiceabilityResponse>('/rapidshyp/apis/v1/serviceabilty_check', {
        Pickup_pincode: this.config.originPincode,
        Delivery_pincode: this.config.originPincode,
        cod: false,
        total_order_value: 100,
        weight: 0.5,
      })
      return { ok: true, message: `Connected to RapidShyp at ${this.baseUrl}.` }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'RapidShyp rejected the API key. Check Settings > API on the RapidShyp dashboard.',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify RapidShyp credentials.',
      }
    }
  }
}

const fields: ProviderField[] = [
  {
    key: 'apiKey',
    label: 'API key',
    secret: true,
    required: true,
    help: 'From the RapidShyp dashboard: Settings > API.',
  },
  {
    key: 'storeName',
    label: 'Store name',
    required: true,
    help: 'RapidShyp\'s channel identifier. Use "DEFAULT" unless RapidShyp set up a named channel for you.',
  },
  {
    key: 'pickupAddressName',
    label: 'Pickup location nickname',
    required: true,
    help: 'The registered pickup location nickname, spelled exactly as on the RapidShyp dashboard.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  {
    key: 'baseUrl',
    label: 'API base URL',
    help: 'Leave blank for production.',
  },
]

export const rapidshypFactory: ShippingProviderFactory<RapidshypConfig> = {
  id: 'rapidshyp',
  label: 'RapidShyp',
  fields,
  capabilities: RAPIDSHYP_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.apiKey?.trim()) errors.push('API key is required')
    if (!r.storeName?.trim()) errors.push('store name is required')
    if (!r.pickupAddressName?.trim()) errors.push('pickup location nickname is required')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    const baseUrlProblem = courierBaseUrlProblem(r.baseUrl, ['rapidshyp.com'])
    if (baseUrlProblem) errors.push(baseUrlProblem)
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        apiKey: r.apiKey as string,
        storeName: (r.storeName as string).trim(),
        pickupAddressName: (r.pickupAddressName as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        baseUrl: r.baseUrl?.trim() || undefined,
      },
    }
  },
  create: (config) => new RapidshypProvider(config),
}
