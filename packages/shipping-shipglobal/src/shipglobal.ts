/**
 * ShipGlobal adapter, for exports from India.
 *
 * Built on ShipGlobal's vendor API ("ApiV1 ShipGlobal Vendor - Production",
 * https://developer.docs.shipglobal.in/, published 2026-11-03). Every call is a POST with
 * HTTP Basic auth (the API username and password from ShipGlobal):
 *
 *   /apiv1/rates/calculate          {package_weight kg, country_iso_code_2, postcode}
 *                                   -> {success, billed_weight, currency, services[]}
 *   /apiv1/order/add                the order and its customs lines
 *   /apiv1/order/getLabel           {tracking, label:true} -> pays from the wallet, {label}
 *   /apiv1/tools/tracking           {tracking} -> {data.awbEvents[]}
 *   /apiv1/order/cancelRefundOrder  {tracking} -> {success, msg}
 *
 * A wrong login answers `{success:false, error_code:"EA_401"}` (HTTP 401). The pickup address
 * and the seller's GSTIN and IEC come from the ShipGlobal account itself (its KYC), not from
 * the order; `address_nickname` picks a pickup address other than the default.
 *
 * Every field the docs do not explain, and how this adapter fills it, carries a `VERIFY:` note.
 *
 * DECISIONS:
 *  - Exports only (`coverage: 'international'`), prepaid only (no COD).
 *  - Booking is two calls: order/add saves the order, getLabel pays for it and returns the
 *    PDF. If the second fails, the error names the saved order's tracking number so the
 *    merchant pays for it in ShipGlobal rather than booking it twice.
 *  - `order_reference` is our order id (a UUID), never the order number, so a ShipGlobal
 *    account also used from Shopify (same order numbers) cannot clash.
 */

import {
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  customsLines,
  indiaLocalTime,
  isDomesticCountry,
  missingHsCodeMessage,
  type RateOption,
  type RateQuery,
  type RateQuote,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingLabelDocument,
  type ShippingProvider,
  type Tracking,
  type TrackingEvent,
} from '@commerce/shipping'
import { SHIPGLOBAL_API_URL, SHIPGLOBAL_TRACKING_PAGE, type ShipglobalServiceCode } from './client'
import {
  billedGrams,
  carrierOf,
  cm,
  eventInstant,
  kg,
  phoneOf,
  rupees,
  splitName,
  statusOfEvent,
  streetLines,
  transitDays,
} from './mapping'

export type ShipglobalConfig = {
  /** The API username from ShipGlobal (Settings › API). */
  username: string
  password: string
  /** ShipGlobal's `address_nickname`: a saved pickup address other than the default. */
  addressNickname?: string | undefined
  /** ShipGlobal's `customer_nickname`, required for franchise accounts only. */
  customerNickname?: string | undefined
  originPincode: string
  originCity: string
  /** Importer-Exporter Code. Kept on file; ShipGlobal reads it from the account's KYC. */
  iec?: string | undefined
  /** EU IOSS number, for low-value parcels to the EU. */
  iossNumber?: string | undefined
  /** The service booked when the rate table picked none. */
  service: ShipglobalServiceCode
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined
  /** Injected for tests; defaults to the wall clock. */
  now?: (() => Date) | undefined
}

const QUICK_TIMEOUT_MS = 10_000
const BOOKING_TIMEOUT_MS = 30_000
const DEFAULT_BOX_CM = { length: 10, width: 10, height: 10 }
const AUTH_ERROR_CODE = 'EA_401'
const REFUSED_LOGIN =
  'ShipGlobal did not accept this API username or password. Copy them again from ShipGlobal › Settings › API.'

/** Every answer carries `success`; a refusal adds `error` (and often `error_code`) or `msg`. */
type Answer = {
  success?: boolean
  error?: string
  error_code?: string
  msg?: string
  message?: string
}

type RatesResponse = Answer & {
  billed_weight?: number
  billed_weight_unit?: string
  currency?: string
  services?: {
    title?: string
    notes?: string
    transit_time?: string
    price?: { logistic_fee?: number }
    subtotal_fee?: number
  }[]
}

/**
 * VERIFY: the docs show no answer for order/add. ShipGlobal's other answers put the number in
 * `tracking`, so that is read first, then the likely nested spellings.
 */
type AddOrderResponse = Answer & {
  tracking?: string
  awb?: string
  awb_number?: string
  data?: { tracking?: string; awb?: string; awb_number?: string; order_reference?: string }
}

type LabelResponse = Answer & { tracking?: string; label?: string }

type TrackingResponse = Answer & {
  data?: {
    awbEvents?: {
      awb_history_datetime?: string
      awb_history_location?: string
      awb_history_comment?: string
      awb_event_code?: string
    }[]
  }
}

const reasonOf = (a: Answer) => (a.error || a.msg || a.message || '').trim()

export class ShipglobalProvider implements ShippingProvider {
  readonly id = 'shipglobal'
  readonly label = 'ShipGlobal'
  readonly coverage = 'international' as const
  readonly tracksManually = false

  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date

  constructor(private readonly config: ShipglobalConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch
    this.now = config.now ?? (() => new Date())
  }

  private authorization(): string {
    const pair = `${this.config.username}:${this.config.password}`
    return `Basic ${Buffer.from(pair, 'utf8').toString('base64')}`
  }

  /**
   * One ShipGlobal call. A refused login (HTTP 401, or EA_401 in the body) is an `auth` error;
   * any other `success: false` is `rejected` with ShipGlobal's own reason, which is what the
   * merchant needs to fix it. The URL, body and password never go into a message.
   */
  private async call<T extends Answer>(
    path: string,
    body: unknown,
    timeoutMs = QUICK_TIMEOUT_MS,
  ): Promise<T> {
    let res: Response
    try {
      res = await this.fetchImpl(`${SHIPGLOBAL_API_URL}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: this.authorization(),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new CourierError(
          'timeout',
          this.id,
          `ShipGlobal did not answer within ${timeoutMs}ms.`,
          {
            cause: error,
          },
        )
      }
      throw new CourierError('unavailable', this.id, 'Could not reach ShipGlobal.', {
        cause: error,
      })
    }
    const text = await res.text()
    let parsed: T | null = null
    try {
      parsed = text ? (JSON.parse(text) as T) : ({} as T)
    } catch {
      parsed = null
    }
    if (res.status === 401 || res.status === 403 || parsed?.error_code === AUTH_ERROR_CODE) {
      throw new CourierError('auth', this.id, REFUSED_LOGIN, { status: res.status })
    }
    if (res.status === 429) {
      throw new CourierError('rate_limited', this.id, 'ShipGlobal is rate limiting us.', {
        status: res.status,
      })
    }
    if (!parsed) {
      throw new CourierError(
        !res.ok && res.status < 500 ? 'rejected' : res.ok ? 'bad_response' : 'unavailable',
        this.id,
        res.ok ? 'ShipGlobal returned a non-JSON body.' : `ShipGlobal returned HTTP ${res.status}.`,
        { status: res.status },
      )
    }
    if (!res.ok || parsed.success === false) {
      const reason = reasonOf(parsed)
      throw new CourierError(
        res.status >= 500 ? 'unavailable' : 'rejected',
        this.id,
        reason ? `ShipGlobal: ${reason}` : `ShipGlobal returned HTTP ${res.status}.`,
        { status: res.status },
      )
    }
    return parsed
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const abroad = !isDomesticCountry(query.destinationCountry)
    return {
      provider: this.id,
      serviceable: abroad,
      codAvailable: false,
      prepaidAvailable: abroad,
      // Transit comes per service with the live rates, not here.
      minTransitDays: null,
      maxTransitDays: null,
      reason: abroad ? null : 'ShipGlobal ships from India to other countries only.',
    }
  }

  /** Every service ShipGlobal offers for this parcel, priced live. Empty at home or for COD. */
  async quoteOptions(query: RateQuery): Promise<RateOption[]> {
    if (isDomesticCountry(query.destinationCountry) || query.paymentMode === 'cod') return []
    const data = await this.call<RatesResponse>('/apiv1/rates/calculate', {
      package_weight: kg(query.weightGrams),
      country_iso_code_2: (query.destinationCountry ?? '').trim().toUpperCase(),
      postcode: query.destinationPincode.trim(),
    })
    // The docs answer in INR; any other currency is not priced rather than mispriced.
    if ((data.currency ?? 'INR').toUpperCase() !== 'INR') return []
    const chargeable = billedGrams(data.billed_weight, data.billed_weight_unit)
    return (data.services ?? []).flatMap((s): RateOption[] => {
      const title = s.title?.trim()
      // VERIFY: whether subtotal_fee includes GST; it is the total the docs show per service.
      const total = s.subtotal_fee ?? s.price?.logistic_fee
      if (!title || typeof total !== 'number' || !Number.isFinite(total)) return []
      const pricePaise = Math.round(total * 100)
      const freight = s.price?.logistic_fee
      const freightPaise =
        typeof freight === 'number' && Number.isFinite(freight) ? Math.round(freight * 100) : null
      const charges: RateOption['charges'] =
        freightPaise === null
          ? []
          : [
              { kind: 'freight', pricePaise: freightPaise },
              ...(pricePaise > freightPaise
                ? [{ kind: 'other' as const, pricePaise: pricePaise - freightPaise }]
                : []),
            ]
      const days = transitDays(s.transit_time)
      return [
        {
          serviceId: title,
          serviceLabel: title,
          carrier: carrierOf(title),
          pricePaise,
          minTransitDays: days.min,
          maxTransitDays: days.max,
          codAvailable: false,
          charges,
          chargeableWeightGrams: chargeable,
        },
      ]
    })
  }

  /** The configured service's price, or the cheapest when ShipGlobal does not offer it here. */
  async quoteRate(query: RateQuery): Promise<RateQuote | null> {
    const options = await this.quoteOptions(query)
    if (!options.length) return null
    const want = this.config.service.toLowerCase()
    const pick =
      options.find((o) => o.serviceId.toLowerCase() === want) ??
      options.reduce((a, b) => (b.pricePaise < a.pricePaise ? b : a))
    return {
      pricePaise: pick.pricePaise,
      minTransitDays: pick.minTransitDays,
      maxTransitDays: pick.maxTransitDays,
    }
  }

  buildOrderPayload(input: CreateShipmentInput) {
    const customs = customsLines(input)
    if (!customs.ok) {
      throw new CourierError(
        'rejected',
        this.id,
        missingHsCodeMessage('ShipGlobal', customs.missingHsCode),
      )
    }
    // VERIFY: the order sample spells it "Shipglobal Direct", the rates answer "ShipGlobal
    // Direct"; we send the rates' own title.
    const service = input.serviceId?.trim() || this.config.service
    const buyer = splitName(input.to.name)
    const [line1, line2, line3] = streetLines(input.to)
    const box = input.dimensionsCm ?? DEFAULT_BOX_CM
    const ioss = this.config.iossNumber?.trim() ?? ''
    const customerNickname = this.config.customerNickname?.trim()
    return {
      service,
      payload: {
        // VERIFY: the docs want invoice_no unique; the order number is unique per store.
        invoice_no: String(input.orderNumber),
        invoice_date: indiaLocalTime(this.now()).slice(0, 10),
        order_reference: input.orderId,
        service,
        package_weight: kg(input.weightGrams),
        package_length: cm(box.length),
        package_breadth: cm(box.width),
        package_height: cm(box.height),
        // The order's own currency; ShipGlobal lists INR among its supported codes.
        currency_code: 'INR',
        // 1 = export under CSB-V (the e-commerce courier shipping bill), per the docs.
        csb5_status: 1,
        address_nickname: this.config.addressNickname?.trim() ?? '',
        ...(customerNickname ? { customer_nickname: customerNickname } : {}),
        customer_shipping_firstname: buyer.first,
        customer_shipping_lastname: buyer.last,
        customer_shipping_mobile: phoneOf(input.to.phone),
        // VERIFY: an order with no shopper email; ShipGlobal marks the field required.
        customer_shipping_email: input.to.email?.trim() ?? '',
        customer_shipping_company: '',
        customer_shipping_address: line1,
        customer_shipping_address_2: line2,
        customer_shipping_address_3: line3,
        customer_shipping_city: input.to.city,
        customer_shipping_postcode: input.to.pincode.trim(),
        customer_shipping_country_code: input.to.country.trim().toUpperCase(),
        customer_shipping_state: input.to.state || input.to.city,
        ioss_number: ioss,
        vendor_order_items: customs.lines.map((l, i) => ({
          vendor_order_item_name: l.title.slice(0, 200),
          vendor_order_item_sku: l.sku?.trim() || `LINE-${i + 1}`,
          vendor_order_item_quantity: String(l.quantity),
          vendor_order_item_unit_price: rupees(l.unitPricePaise),
          vendor_order_item_hsn: l.hsCode,
          // VERIFY: exports under a LUT are zero-rated, so 0; ask if ShipGlobal wants the IGST rate.
          vendor_order_item_tax_rate: '0',
        })),
      },
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (isDomesticCountry(input.to.country)) {
      throw new CourierError(
        'rejected',
        this.id,
        'ShipGlobal ships from India to other countries only. Book this order with a domestic courier.',
      )
    }
    if (input.paymentMode === 'cod') {
      throw new CourierError(
        'rejected',
        this.id,
        'ShipGlobal exports cannot collect cash on delivery.',
      )
    }
    const { payload } = this.buildOrderPayload(input)
    const added = await this.call<AddOrderResponse>('/apiv1/order/add', payload, BOOKING_TIMEOUT_MS)
    const tracking = (
      added.tracking ||
      added.data?.tracking ||
      added.awb_number ||
      added.data?.awb_number ||
      added.awb ||
      added.data?.awb ||
      ''
    ).trim()
    if (!tracking) {
      const reason = reasonOf(added)
      throw new CourierError(
        'bad_response',
        this.id,
        `ShipGlobal saved nothing we can track: no tracking number came back${reason ? ` (${reason})` : ''}. Check the order in your ShipGlobal panel before booking again.`,
      )
    }
    let label: LabelResponse
    try {
      label = await this.call<LabelResponse>(
        '/apiv1/order/getLabel',
        { tracking, label: true },
        BOOKING_TIMEOUT_MS,
      )
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'no label came back'
      throw new CourierError(
        error instanceof CourierError ? error.kind : 'unavailable',
        this.id,
        `ShipGlobal saved the order as ${tracking} but did not take payment for its label: ${reason}. Pay for it in your ShipGlobal panel; booking again here would add a second order.`,
        { cause: error },
      )
    }
    const pdf = label.label?.trim()
    return {
      waybill: tracking,
      providerRef: tracking,
      trackingUrl: SHIPGLOBAL_TRACKING_PAGE,
      ...(pdf ? { documents: [{ kind: 'label' as const, pdfBase64: pdf }] } : {}),
    }
  }

  /** The label again, for a paid order. VERIFY: that a second getLabel does not charge again. */
  async getLabel(waybill: string): Promise<ShippingLabelDocument> {
    const label = await this.call<LabelResponse>('/apiv1/order/getLabel', {
      tracking: waybill,
      label: true,
    })
    if (!label.label) {
      throw new CourierError(
        'bad_response',
        this.id,
        'ShipGlobal returned no label for this parcel.',
      )
    }
    return {
      contentType: 'application/pdf',
      body: new Uint8Array(Buffer.from(label.label, 'base64')),
    }
  }

  async track(waybill: string): Promise<Tracking> {
    const data = await this.call<TrackingResponse>('/apiv1/tools/tracking', { tracking: waybill })
    const events: TrackingEvent[] = (data.data?.awbEvents ?? [])
      .flatMap((e): TrackingEvent[] => {
        const at = eventInstant(e.awb_history_datetime)
        if (!at) return []
        const location = e.awb_history_location?.trim()
        return [
          {
            at,
            status: statusOfEvent(e.awb_event_code),
            description: (e.awb_history_comment ?? '').trim() || (e.awb_event_code ?? ''),
            ...(location ? { location } : {}),
          },
        ]
      })
      .sort((a, b) => a.at.localeCompare(b.at))
    return {
      waybill,
      status: events.at(-1)?.status ?? 'created',
      events,
      trackingUrl: SHIPGLOBAL_TRACKING_PAGE,
    }
  }

  /** Cancels and refunds to the wallet. "Order Already Cancelled" answers success too. */
  async cancel(waybill: string): Promise<void> {
    await this.call<Answer>('/apiv1/order/cancelRefundOrder', { tracking: waybill })
  }

  /**
   * A tiny rate lookup: read-only, books nothing, and needs the login like every call.
   * Only a 401 / EA_401 means the login is wrong; anything else is reported as it is.
   */
  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.call<RatesResponse>('/apiv1/rates/calculate', {
        package_weight: '0.5',
        country_iso_code_2: 'US',
        postcode: '10001',
      })
      return {
        ok: true,
        message: `Connected to ShipGlobal. Live rates work; labels default to ${this.config.service}.`,
      }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return { ok: false, message: REFUSED_LOGIN }
      }
      if (error instanceof CourierError && error.kind === 'rejected') {
        // Signed in: ShipGlobal only refused the sample parcel.
        return { ok: true, message: `Connected to ShipGlobal. ${error.message}` }
      }
      return {
        ok: false,
        message: `Could not check the ShipGlobal login: ${error instanceof Error ? error.message : 'unknown error'} Try again in a minute.`,
      }
    }
  }
}
