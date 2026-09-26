/**
 * RapidShyp adapter - an Indian multi-courier aggregator (rapidshyp.com),
 * same shape of integration as Shiprocket: one account, many underlying
 * couriers, a single "serviceability" call answers both "can you deliver
 * here" and "what would it cost".
 *
 * Base URL, auth header and the three endpoints below are confirmed against
 * RapidShyp's own rendered docs (docs.rapidshyp.com/docs/api-overview and its
 * per-endpoint pages), fetched directly in this environment - unlike
 * Shiprocket's apidocs.shiprocket.in, RapidShyp's docs pages rendered enough
 * static content to read field-by-field:
 *
 *   POST /rapidshyp/apis/v1/serviceability_check   rate + ETA per courier for a route
 *        docs.rapidshyp.com/docs/documentationsidebar/pincode%20serviceability%20api/%20b2c%20pincode%20serviceability/
 *   POST /rapidshyp/apis/v1/create_order            create order (+ shipment, AWB assigned automatically)
 *        docs.rapidshyp.com/docs/documentationsidebar/forward%20b2c/orders/post%20create%20order%20api/
 *   POST /rapidshyp/apis/v1/cancel_order            cancel by seller order id
 *        docs.rapidshyp.com/docs/documentationsidebar/forward%20b2c/orders/post%20cancel%20order/
 *
 * All under https://api.rapidshyp.com, header `rapidshyp-token: <API key>`
 * (a static per-account key from the RapidShyp dashboard, not a login/session
 * token like Shiprocket's - so there is no token-refresh cycle here).
 *
 * NOT CONFIRMED, LEFT OUT OF CAPABILITIES: every other page under RapidShyp's
 * docs sidebar (AWB re-assignment, label generation, pickup scheduling,
 * order/AWB tracking, webhooks, NDR actions, wallet balance) renders as a
 * client-side app shell in this environment with no fetchable static
 * content, and no secondary source (community SDK, a readable Postman
 * export) turned up exact paths or field names either - the "shipment"
 * array `create_order` returns is documented only as "structure not
 * detailed", so this file does not guess at its keys beyond the common
 * ones several aggregators use (`awb`, `awb_number`, `waybill`). `track()`
 * is required by the shared contract; it throws `CourierError('unavailable')`
 * here rather than guess at an endpoint. See `RAPIDSHYP_CAPABILITIES` below
 * and the PR description for the full confirmed/unconfirmed list.
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
  type ProviderField,
  type RateQuery,
  type RateQuote,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingCapability,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
} from '@commerce/shipping'

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

type CreateOrderShipment = {
  awb?: string
  awb_number?: string
  waybill?: string
  shipment_id?: string | number
  courier_name?: string
  label_url?: string
}

type CreateOrderResponse = {
  status?: boolean
  remarks?: string
  order_id?: string
  shipment?: CreateOrderShipment[]
}

/** Estimated-delivery-date strings ("edd") are free text in RapidShyp's docs sample
 *  ("YYYY-MM-DD" is the documented shape but not guaranteed); this only ever reads
 *  a leading date, never assumes a full timestamp is present. */
function daysFromToday(dateStr: string | undefined): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr.slice(0, 10))
  if (Number.isNaN(target.getTime())) return null
  const days = Math.round((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  return days > 0 ? days : null
}

export class RapidshypProvider implements ShippingProvider {
  readonly id = 'rapidshyp'
  readonly label = 'RapidShyp'

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch

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

  /** Shared by checkServiceability, quoteRate and listCourierOptions - one call answers all three. */
  private async serviceability(query: {
    originPincode: string
    destinationPincode: string
    weightGrams?: number | null | undefined
    declaredValue?: number | undefined
    cod?: boolean | undefined
  }): Promise<ServiceableCourier[]> {
    const weightKg = Math.max((query.weightGrams ?? 500) / 1000, 0.01)
    const data = await this.postJson<ServiceabilityResponse>(
      '/rapidshyp/apis/v1/serviceability_check',
      {
        Pickup_pincode: query.originPincode,
        Delivery_pincode: query.destinationPincode,
        cod: Boolean(query.cod),
        total_order_value: query.declaredValue ?? 0,
        weight: weightKg,
      },
    )
    return data.serviceable_courier_list ?? []
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const couriers = await this.serviceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      declaredValue: query.declaredValue ?? undefined,
    })
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
    /* RapidShyp's serviceability response has no per-courier COD flag in the
       documented fields; a second call with cod:true is the only confirmed
       way to learn COD availability, so this checks it as a real call rather
       than guessing. */
    const codCouriers = await this.serviceability({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      weightGrams: query.weightGrams,
      declaredValue: query.declaredValue ?? undefined,
      cod: true,
    })
    const days = couriers.map((c) => daysFromToday(c.edd)).filter((n): n is number => n !== null)
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
    const days = daysFromToday(cheapest.edd)
    return { pricePaise: Math.round(price * 100), minTransitDays: days, maxTransitDays: days }
  }

  /** Every serviceable courier for a route, for the Shipments workspace's rate
   *  comparison table - not part of the shared contract, called directly the
   *  same way `ShiprocketProvider.listCourierOptions` is. */
  async listCourierOptions(query: RateQuery): Promise<
    Array<{
      courierId: string
      courierName: string
      pricePaise: number
      minTransitDays: number | null
      maxTransitDays: number | null
      codAvailable: boolean
    }>
  > {
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
    return couriers
      .map((c) => {
        const price = Number(c.total_freight)
        const days = daysFromToday(c.edd)
        return {
          courierId: c.courier_code ?? '',
          courierName: c.courier_name ?? 'RapidShyp courier',
          pricePaise: Number.isFinite(price) ? Math.round(price * 100) : 0,
          minTransitDays: days,
          maxTransitDays: days,
          codAvailable: codCodes.has(c.courier_code),
        }
      })
      .filter((c) => c.courierId)
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

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const order = await this.postJson<CreateOrderResponse>(
      '/rapidshyp/apis/v1/create_order',
      this.buildOrderPayload(input),
    )
    if (!order.status || !order.order_id) {
      throw new CourierError(
        'rejected',
        this.id,
        `RapidShyp rejected the order: ${order.remarks || 'no detail returned'}`,
      )
    }
    const first = order.shipment?.[0]
    const waybill = first?.awb ?? first?.awb_number ?? first?.waybill
    if (!waybill) {
      throw new CourierError(
        'bad_response',
        this.id,
        'RapidShyp created the order but did not return an AWB (its create_order response ' +
          'documents a "shipment" array with no field-level detail, so this could not be ' +
          'matched against a confirmed shape).',
      )
    }
    return {
      waybill,
      providerRef: String(first?.shipment_id ?? order.order_id),
      labelUrl: first?.label_url,
    }
  }

  async track(_waybill: string): Promise<Tracking> {
    void _waybill
    throw new CourierError(
      'unavailable',
      this.id,
      'RapidShyp tracking is not wired here: no tracking endpoint could be confirmed against ' +
        'fetchable docs. Track this AWB from the RapidShyp dashboard for now.',
    )
  }

  async cancel(waybill: string): Promise<void> {
    /* cancel_order takes RapidShyp's own orderId, not the AWB; the shared
       shipment record's providerRef is `shipment_id` (or `order_id` as a
       fallback) from createShipment - not the seller orderId either, so a
       true cancel-by-AWB would need the order id tracked alongside it. Left
       as a documented gap, same shape as Shiprocket's cancel(). */
    void waybill
    throw new CourierError(
      'unavailable',
      this.id,
      'Cancel needs the RapidShyp order id, which is not part of the shared shipment record ' +
        '(cancel_order takes { orderId, storeName }, not the AWB). Cancel from the RapidShyp ' +
        'dashboard for now.',
    )
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.postJson<ServiceabilityResponse>('/rapidshyp/apis/v1/serviceability_check', {
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

/** What this adapter can do today, confirmed against fetchable RapidShyp docs only. Label
 *  generation, pickup scheduling, tracking, webhooks, NDR actions and wallet balance are all
 *  left out - see the file header comment and the PR description for why. */
export const RAPIDSHYP_CAPABILITIES: ShippingCapability[] = [
  'serviceability',
  'rates',
  'create_shipment',
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
    if (r.baseUrl?.trim() && !/^https:\/\//.test(r.baseUrl.trim()))
      errors.push('base URL must start with https://')
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
