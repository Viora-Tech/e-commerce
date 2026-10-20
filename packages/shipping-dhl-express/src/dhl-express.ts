/**
 * DHL Express adapter (MyDHL API), for exports from India: rates, shipment with label and
 * commercial invoice, a pickup booked with the shipment, tracking.
 *
 * Every call here was checked against DHL's own OpenAPI file for MyDHL API 3.3.1
 * (`dpdhl-express-api-3.3.1.yaml`, released 2026-06-28, the file developer.dhl.com hands out;
 * read from a copy bundled in an open-source client because the portal page is an app shell):
 *
 *   POST   /rates                                       products, prices, transit days
 *   POST   /shipments                                   AWB + label + invoice (base64 PDFs)
 *   GET    /shipments/{awb}/tracking                    events, oldest first
 *   DELETE /pickups/{dispatchConfirmationNumber}        cancel the pickup booked with a shipment
 *   GET    /address-validate                            read-only, used to test the keys
 *
 * Hosts: `https://express.api.dhl.com/mydhlapi/test` (sandbox) and `.../mydhlapi` (live), HTTP
 * Basic auth with the API key and secret DHL issues per developer app, plus the merchant's DHL
 * account number in the body. The sandbox only tracks a fixed list of test AWBs.
 *
 * DECISIONS:
 *  - Exports only (`coverage: 'international'`). DHL Express carries no domestic parcels inside
 *    India (Blue Dart does that for the DHL group), so an Indian PIN code is answered "no"
 *    without a call.
 *  - Customs value and line prices are declared in INR, the currency the order was paid in;
 *    DHL converts for the destination's customs. Rates come back in the account's billing
 *    currency, which is INR for an Indian account; a price in any other currency is dropped
 *    rather than mislabelled as rupees.
 *  - Incoterm DAP: the shopper's country charges its duties to the shopper, the usual setting
 *    for a shop selling abroad. DDP needs a duty-billing account and is not offered yet.
 *  - The pickup is booked inside the shipment call (`pickup.isRequested`, on by default), so
 *    `providerRef` holds the pickup's dispatch confirmation number and `cancel` cancels it.
 *    MyDHL API has no "void an AWB" call: a waybill that is never handed over is never billed.
 *  - No webhook: DHL offers MyDHL API users no push, so the shared poll job tracks.
 */

import {
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  customsLines,
  indiaLocalTime,
  isDomesticCountry,
  isValidPincode,
  missingHsCodeMessage,
  type ProviderField,
  type RateCharge,
  type RateOption,
  type RateQuery,
  type RateQuote,
  type Serviceability,
  type ServiceabilityQuery,
  type ShipmentAddress,
  type ShipmentDocument,
  type ShipmentStatus,
  type ShippingProvider,
  type ShippingProviderFactory,
  type Tracking,
  type TrackingEvent,
  wrapAddressLines,
} from '@commerce/shipping'
import { DHL_EXPRESS_CAPABILITIES, DHL_EXPRESS_LIVE_URL, DHL_EXPRESS_TEST_URL } from './client'

export type DhlExpressConfig = {
  apiKey: string
  apiSecret: string
  /** The DHL Express account the shipments are billed to (shipper account). */
  accountNumber: string
  originPincode: string
  /** Rates need a city next to the postal code; the booking uses the pickup address's own. */
  originCity: string
  /** Importer-Exporter Code, printed on the commercial invoice as the exporter id. */
  iec?: string | undefined
  mode: 'test' | 'live'
  /** Request a DHL pickup with every shipment. */
  bookPickup: boolean
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch | undefined
  /** Injected for tests; defaults to the wall clock. */
  now?: (() => Date) | undefined
}

/** Quotes and tracking answer a person waiting on screen; a booking renders PDFs, so it gets longer. */
const QUICK_TIMEOUT_MS = 10_000
const BOOKING_TIMEOUT_MS = 30_000

const DEFAULT_PRODUCT = 'P' // EXPRESS WORLDWIDE (non-documents)
const DEFAULT_BOX_CM = { length: 10, width: 10, height: 10 }

type DhlPrice = { currencyType?: string; priceCurrency?: string; price?: number }

type DhlProduct = {
  productName?: string
  productCode?: string
  weight?: { volumetric?: number; provided?: number }
  totalPrice?: DhlPrice[]
  totalPriceBreakdown?: Array<{
    currencyType?: string
    priceCurrency?: string
    priceBreakdown?: Array<{ typeCode?: string; price?: number }>
  }>
  detailedPriceBreakdown?: Array<{
    currencyType?: string
    priceCurrency?: string
    breakdown?: Array<{ name?: string; serviceCode?: string; price?: number }>
  }>
  deliveryCapabilities?: { totalTransitDays?: number | string }
}

type DhlRatesResponse = { products?: DhlProduct[] }

type DhlShipmentResponse = {
  shipmentTrackingNumber?: string
  dispatchConfirmationNumber?: string
  documents?: Array<{ imageFormat?: string; content?: string; typeCode?: string }>
  shipmentCharges?: DhlPrice[]
}

type DhlTrackingResponse = {
  shipments?: Array<{
    shipmentTrackingNumber?: string
    status?: string
    events?: Array<{
      date?: string
      time?: string
      GMTOffset?: string
      typeCode?: string
      description?: string
      serviceArea?: Array<{ code?: string; description?: string }>
    }>
    estimatedDeliveryDate?: string
  }>
}

type DhlProblem = {
  title?: string
  detail?: string
  additionalDetails?: string[]
}

/**
 * DHL checkpoint codes (the tracking examples in the OpenAPI file), reduced to ours. Anything
 * unlisted is a movement scan, so `in_transit`; never a guessed terminal state.
 */
export function mapDhlEvent(code: string | undefined): ShipmentStatus {
  switch ((code ?? '').toUpperCase()) {
    case 'OK':
      return 'delivered'
    case 'WC':
      return 'out_for_delivery'
    case 'PU':
      return 'picked_up'
    case 'RT':
    case 'RD':
      return 'rto'
    case 'CA':
      return 'cancelled'
    case 'SA':
    case 'PL':
      return 'created'
    default:
      return 'in_transit'
  }
}

/** 45 characters is DHL's limit for each address line; a longer line spills into the next. */
function addressLines(a: ShipmentAddress) {
  const [addressLine1 = a.city, addressLine2, addressLine3] = wrapAddressLines(
    [a.line1, a.line2],
    45,
    3,
  )
  return {
    addressLine1,
    ...(addressLine2 ? { addressLine2 } : {}),
    ...(addressLine3 ? { addressLine3 } : {}),
  }
}

function postalAddress(a: ShipmentAddress) {
  const country = isDomesticCountry(a.country) ? 'IN' : a.country.trim().toUpperCase()
  const province = a.state?.trim()
  return {
    postalCode: a.pincode.trim().slice(0, 12),
    cityName: a.city.trim().slice(0, 45),
    countryCode: country,
    ...(province && province.length >= 2 ? { provinceCode: province.slice(0, 35) } : {}),
    ...addressLines(a),
  }
}

const kg = (grams: number) => Math.max(Math.round(grams) / 1000, 0.001)
const rupees = (paise: number) => Math.round(paise) / 100

function chargeKind(serviceCode: string | undefined): RateCharge['kind'] {
  if (!serviceCode) return 'freight'
  if (serviceCode === 'FF') return 'fuel'
  if (serviceCode === 'II') return 'insurance'
  return 'other'
}

export class DhlExpressProvider implements ShippingProvider {
  readonly id = 'dhl-express'
  readonly label = 'DHL Express'
  readonly coverage = 'international' as const

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date

  constructor(private readonly config: DhlExpressConfig) {
    this.baseUrl = config.mode === 'live' ? DHL_EXPRESS_LIVE_URL : DHL_EXPRESS_TEST_URL
    this.fetchImpl = config.fetchImpl ?? fetch
    this.now = config.now ?? (() => new Date())
  }

  /**
   * One MyDHL API call. Unlike `courierFetch`, a 4xx body is read: DHL explains a refused
   * booking there ("The postal code is invalid", "Commodity code missing"), and that is
   * what the merchant needs to fix it. The URL never goes into a message (it carries the AWB).
   */
  private async call<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    options: { query?: Record<string, string>; body?: unknown; timeoutMs?: number } = {},
  ): Promise<T> {
    const qs = options.query ? `?${new URLSearchParams(options.query).toString()}` : ''
    const auth = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64')
    const timeoutMs = options.timeoutMs ?? QUICK_TIMEOUT_MS
    let res: Response
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}${qs}`, {
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: 'application/json',
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new CourierError(
          'timeout',
          this.id,
          `DHL Express did not answer within ${timeoutMs}ms.`,
          {
            cause: error,
          },
        )
      }
      throw new CourierError('unavailable', this.id, 'Could not reach DHL Express.', {
        cause: error,
      })
    }
    if (res.status === 401 || res.status === 403) {
      throw new CourierError('auth', this.id, 'DHL Express rejected the API key or secret.', {
        status: res.status,
      })
    }
    if (res.status === 429) {
      throw new CourierError('rate_limited', this.id, 'DHL Express is rate limiting us.', {
        status: res.status,
      })
    }
    const text = await res.text()
    if (!res.ok) {
      let problem: DhlProblem = {}
      try {
        problem = JSON.parse(text) as DhlProblem
      } catch {
        // An HTML error page: the status alone has to do.
      }
      const detail = [problem.detail, ...(problem.additionalDetails ?? [])]
        .filter(Boolean)
        .join(' ')
      throw new CourierError(
        res.status >= 500 ? 'unavailable' : 'rejected',
        this.id,
        detail ? `DHL Express: ${detail}` : `DHL Express returned HTTP ${res.status}.`,
        { status: res.status },
      )
    }
    if (!text) return {} as T
    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new CourierError('bad_response', this.id, 'DHL Express returned a non-JSON body.', {
        cause: error,
      })
    }
  }

  /** DHL wants the tender time in the shipper's local time with its offset, never in the past. */
  private shipTime(minutesAhead: number): string {
    return `${indiaLocalTime(this.now(), minutesAhead)} GMT+05:30`
  }

  private async rates(query: {
    destinationPincode: string
    destinationCountry: string
    destinationCity: string | undefined
    weightGrams: number
    declaredValuePaise: number
    dimensionsCm?: { length: number; width: number; height: number } | undefined
  }): Promise<DhlProduct[]> {
    if (!query.destinationCity?.trim()) {
      throw new CourierError(
        'rejected',
        this.id,
        'DHL Express needs the destination city to quote. Add it to the shipping address.',
      )
    }
    const data = await this.call<DhlRatesResponse>('POST', '/rates', {
      body: {
        customerDetails: {
          shipperDetails: {
            postalCode: this.config.originPincode,
            cityName: this.config.originCity,
            countryCode: 'IN',
          },
          receiverDetails: {
            postalCode: query.destinationPincode.trim().slice(0, 12),
            cityName: query.destinationCity.trim().slice(0, 45),
            countryCode: query.destinationCountry.trim().toUpperCase(),
          },
        },
        accounts: [{ typeCode: 'shipper', number: this.config.accountNumber }],
        plannedShippingDateAndTime: this.shipTime(60),
        unitOfMeasurement: 'metric',
        isCustomsDeclarable: true,
        monetaryAmount: [
          { typeCode: 'declaredValue', value: rupees(query.declaredValuePaise), currency: 'INR' },
        ],
        nextBusinessDay: true,
        packages: [
          { weight: kg(query.weightGrams), dimensions: query.dimensionsCm ?? DEFAULT_BOX_CM },
        ],
      },
    })
    return data.products ?? []
  }

  /** A product's total in rupees: the billing-currency price when it is INR, else any INR one. */
  private static inrTotal(product: DhlProduct): { paise: number; currencyType: string } | null {
    const prices = product.totalPrice ?? []
    const rupeePrice =
      prices.find((p) => p.currencyType === 'BILLC' && p.priceCurrency === 'INR') ??
      prices.find((p) => p.priceCurrency === 'INR')
    if (!rupeePrice || typeof rupeePrice.price !== 'number' || rupeePrice.price <= 0) return null
    return {
      paise: Math.round(rupeePrice.price * 100),
      currencyType: rupeePrice.currencyType ?? 'BILLC',
    }
  }

  private static toOption(product: DhlProduct): RateOption | null {
    const total = DhlExpressProvider.inrTotal(product)
    if (!product.productCode || !total) return null
    const days = Number(product.deliveryCapabilities?.totalTransitDays)
    const transit = Number.isFinite(days) && days > 0 ? days : null
    const detail = product.detailedPriceBreakdown?.find(
      (d) => d.currencyType === total.currencyType,
    )
    const charges: RateCharge[] = (detail?.breakdown ?? []).flatMap((b) =>
      typeof b.price === 'number' && b.price > 0
        ? [{ kind: chargeKind(b.serviceCode), pricePaise: Math.round(b.price * 100) }]
        : [],
    )
    const tax = product.totalPriceBreakdown
      ?.find((d) => d.currencyType === total.currencyType)
      ?.priceBreakdown?.find((b) => b.typeCode === 'STTXA')?.price
    if (typeof tax === 'number' && tax > 0)
      charges.push({ kind: 'gst', pricePaise: Math.round(tax * 100) })
    const chargeable = Math.max(product.weight?.volumetric ?? 0, product.weight?.provided ?? 0)
    return {
      serviceId: product.productCode,
      serviceLabel: titleCase(product.productName ?? product.productCode),
      carrier: null,
      pricePaise: total.paise,
      minTransitDays: transit,
      maxTransitDays: transit,
      codAvailable: false,
      charges,
      chargeableWeightGrams: chargeable > 0 ? Math.round(chargeable * 1000) : null,
    }
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const closed = (reason: string): Serviceability => ({
      provider: this.id,
      serviceable: false,
      codAvailable: false,
      prepaidAvailable: false,
      minTransitDays: null,
      maxTransitDays: null,
      reason,
    })
    if (isDomesticCountry(query.destinationCountry)) {
      return closed('DHL Express ships from India to other countries only.')
    }
    const products = await this.rates({
      destinationPincode: query.destinationPincode,
      destinationCountry: query.destinationCountry as string,
      destinationCity: query.destinationCity,
      weightGrams: query.weightGrams ?? 500,
      declaredValuePaise: Math.round((query.declaredValue ?? 0) * 100),
    })
    if (products.length === 0) return closed('DHL Express offers no product to this address.')
    const days = products
      .map((p) => Number(p.deliveryCapabilities?.totalTransitDays))
      .filter((n) => Number.isFinite(n) && n > 0)
    return {
      provider: this.id,
      serviceable: true,
      // Exports are prepaid by the shop; DHL collects no cash from the shopper.
      codAvailable: false,
      prepaidAvailable: true,
      minTransitDays: days.length ? Math.min(...days) : null,
      maxTransitDays: days.length ? Math.max(...days) : null,
      reason: null,
    }
  }

  async quoteOptions(query: RateQuery): Promise<RateOption[]> {
    if (isDomesticCountry(query.destinationCountry)) return []
    const products = await this.rates({
      destinationPincode: query.destinationPincode,
      destinationCountry: query.destinationCountry as string,
      destinationCity: query.destinationCity,
      weightGrams: query.weightGrams,
      declaredValuePaise: query.declaredValuePaise,
      dimensionsCm: query.dimensionsCm,
    })
    return products.flatMap((p) => DhlExpressProvider.toOption(p) ?? [])
  }

  async quoteRate(query: RateQuery): Promise<RateQuote | null> {
    const options = await this.quoteOptions(query)
    const cheapest = options.reduce<RateOption | null>(
      (min, o) => (!min || o.pricePaise < min.pricePaise ? o : min),
      null,
    )
    return cheapest
      ? {
          pricePaise: cheapest.pricePaise,
          minTransitDays: cheapest.minTransitDays,
          maxTransitDays: cheapest.maxTransitDays,
        }
      : null
  }

  buildShipmentPayload(input: CreateShipmentInput) {
    const customs = customsLines(input)
    if (!customs.ok) {
      throw new CourierError(
        'rejected',
        this.id,
        missingHsCodeMessage('DHL Express', customs.missingHsCode),
      )
    }
    const today = indiaLocalTime(this.now()).slice(0, 10)
    const lineItems = customs.lines.map((l, i) => ({
      number: i + 1,
      description: l.title.slice(0, 512),
      price: rupees(l.unitPricePaise),
      quantity: { value: l.quantity, unitOfMeasurement: 'PCS' },
      commodityCodes: [{ typeCode: 'outbound', value: l.hsCode }],
      exportReasonType: 'permanent',
      manufacturerCountry: l.countryOfOrigin,
      weight: {
        netValue: kg(l.unitWeightGrams * l.quantity),
        grossValue: kg(l.unitWeightGrams * l.quantity),
      },
    }))
    const gstin = input.exporterGstin?.trim()
    const iec = this.config.iec?.trim()
    return {
      plannedShippingDateAndTime: this.shipTime(60),
      pickup: { isRequested: this.config.bookPickup },
      productCode: input.serviceId || DEFAULT_PRODUCT,
      getRateEstimates: true,
      accounts: [{ typeCode: 'shipper', number: this.config.accountNumber }],
      outputImageProperties: {
        encodingFormat: 'pdf',
        imageOptions: [
          { typeCode: 'label', isRequested: true },
          { typeCode: 'invoice', isRequested: true, invoiceType: 'commercial' },
        ],
      },
      customerDetails: {
        shipperDetails: {
          postalAddress: postalAddress({ ...input.from, country: 'IN' }),
          contactInformation: {
            phone: input.from.phone,
            companyName: input.from.name.slice(0, 100),
            fullName: input.from.name.slice(0, 255),
          },
          ...(gstin
            ? { registrationNumbers: [{ typeCode: 'VAT', number: gstin, issuerCountryCode: 'IN' }] }
            : {}),
          typeCode: 'business',
        },
        receiverDetails: {
          postalAddress: postalAddress(input.to),
          contactInformation: {
            phone: input.to.phone,
            companyName: input.to.name.slice(0, 100),
            fullName: input.to.name.slice(0, 255),
          },
          typeCode: 'private',
        },
      },
      content: {
        packages: [
          {
            weight: kg(input.weightGrams),
            dimensions: input.dimensionsCm ?? DEFAULT_BOX_CM,
            customerReferences: [{ value: `Order ${input.orderNumber}`, typeCode: 'CU' }],
          },
        ],
        isCustomsDeclarable: true,
        declaredValue: rupees(input.valuePaise),
        declaredValueCurrency: 'INR',
        exportDeclaration: {
          lineItems,
          invoice: { number: String(input.orderNumber), date: today },
          exportReason: 'Sale',
          exportReasonType: 'permanent',
          ...(iec ? { exporter: { id: iec } } : {}),
        },
        description: customs.lines
          .map((l) => l.title)
          .join(', ')
          .slice(0, 70),
        incoterm: 'DAP',
        unitOfMeasurement: 'metric',
      },
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (isDomesticCountry(input.to.country)) {
      throw new CourierError(
        'rejected',
        this.id,
        'DHL Express ships from India to other countries only. Book this order with a domestic courier.',
      )
    }
    if (input.paymentMode === 'cod') {
      throw new CourierError(
        'rejected',
        this.id,
        'DHL Express exports cannot collect cash on delivery.',
      )
    }
    const result = await this.call<DhlShipmentResponse>('POST', '/shipments', {
      body: this.buildShipmentPayload(input),
      timeoutMs: BOOKING_TIMEOUT_MS,
    })
    if (!result.shipmentTrackingNumber) {
      throw new CourierError(
        'bad_response',
        this.id,
        'DHL Express booked nothing: no waybill came back.',
      )
    }
    const documents: ShipmentDocument[] = (result.documents ?? []).flatMap((d) =>
      d.content && (d.imageFormat ?? 'PDF').toUpperCase() === 'PDF'
        ? [
            {
              kind:
                d.typeCode === 'label'
                  ? ('label' as const)
                  : d.typeCode === 'invoice'
                    ? ('commercial_invoice' as const)
                    : ('other' as const),
              pdfBase64: d.content,
            },
          ]
        : [],
    )
    const charge = DhlExpressProvider.inrTotal({ totalPrice: result.shipmentCharges ?? [] })
    return {
      waybill: result.shipmentTrackingNumber,
      // The pickup's number when one was booked: `cancel` gets it back (core passes providerRef).
      providerRef: result.dispatchConfirmationNumber || result.shipmentTrackingNumber,
      ...(documents.length ? { documents } : {}),
      ...(charge ? { chargePaise: charge.paise } : {}),
    }
  }

  async track(waybill: string): Promise<Tracking> {
    const data = await this.call<DhlTrackingResponse>(
      'GET',
      `/shipments/${encodeURIComponent(waybill)}/tracking`,
      { query: { trackingView: 'all-checkpoints', levelOfDetail: 'shipment' } },
    )
    const shipment = data.shipments?.find(
      (s) => !s.shipmentTrackingNumber || s.shipmentTrackingNumber === waybill,
    )
    if (!shipment)
      throw new CourierError('bad_response', this.id, 'DHL Express has no record of this waybill.')
    const events: TrackingEvent[] = (shipment.events ?? []).map((e) => {
      const offset = /^[+-]\d{2}:\d{2}$/.test(e.GMTOffset ?? '') ? e.GMTOffset : '+05:30'
      const at = new Date(`${e.date ?? '1970-01-01'}T${e.time ?? '00:00:00'}${offset}`)
      const place = e.serviceArea?.[0]?.description
      return {
        at: Number.isNaN(at.getTime()) ? new Date(0).toISOString() : at.toISOString(),
        status: mapDhlEvent(e.typeCode),
        description: e.description || e.typeCode || '',
        ...(place ? { location: place } : {}),
      }
    })
    events.sort((a, b) => a.at.localeCompare(b.at))
    const last = events.at(-1)
    return {
      waybill,
      status: last?.status ?? 'created',
      events,
      trackingUrl: `https://www.dhl.com/in-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(waybill)}`,
      ...(shipment.estimatedDeliveryDate
        ? { expectedDate: shipment.estimatedDeliveryDate.slice(0, 10) }
        : {}),
    }
  }

  /**
   * Cancels the pickup booked with the shipment, when `ref` is its dispatch confirmation number
   * (three letters, then digits: "PRG201220123456"). A bare waybill (no pickup was booked) has
   * nothing to cancel at DHL: MyDHL API has no void call, and an AWB never handed over is not billed.
   */
  async cancel(ref: string): Promise<void> {
    if (!/^[A-Z]{3}\d+$/i.test(ref)) return
    await this.call('DELETE', `/pickups/${encodeURIComponent(ref)}`, {
      query: { requestorName: 'Store admin', reason: 'Order shipment cancelled' },
    })
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      await this.call('GET', '/address-validate', {
        query: {
          type: 'pickup',
          countryCode: 'IN',
          postalCode: this.config.originPincode,
          cityName: this.config.originCity,
        },
      })
      return {
        ok: true,
        message: `Connected to DHL Express (${this.config.mode === 'live' ? 'live' : 'test'}). Pickup PIN ${this.config.originPincode} checks out.`,
      }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'DHL Express did not accept this API key and secret. Copy both again from your app on developer.dhl.com, and check Test or Live matches the keys.',
        }
      }
      if (error instanceof CourierError && error.kind === 'rejected') {
        return { ok: false, message: `${error.message} Check the origin PIN code and city.` }
      }
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : 'Could not verify DHL Express credentials.',
      }
    }
  }
}

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bNondoc\b/i, '')
    .trim()
}

const fields: ProviderField[] = [
  {
    key: 'apiKey',
    label: 'API key',
    required: true,
    help: 'From your app on developer.dhl.com (MyDHL API).',
  },
  { key: 'apiSecret', label: 'API secret', secret: true, required: true },
  {
    key: 'accountNumber',
    label: 'DHL account number',
    required: true,
    help: 'Your 9-digit DHL Express shipper account.',
  },
  { key: 'originPincode', label: 'Origin PIN code', required: true },
  { key: 'originCity', label: 'Origin city', required: true },
  {
    key: 'iec',
    label: 'IEC (Importer-Exporter Code)',
    help: 'Printed on the commercial invoice. 10 characters, from DGFT.',
  },
  {
    key: 'mode',
    label: 'Test or live',
    help: "'test' uses DHL's sandbox; 'live' books real shipments.",
  },
  { key: 'bookPickup', label: 'Book a pickup with each shipment', type: 'boolean' },
]

export const dhlExpressFactory: ShippingProviderFactory<DhlExpressConfig> = {
  id: 'dhl-express',
  label: 'DHL Express',
  fields,
  capabilities: DHL_EXPRESS_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.apiKey?.trim()) errors.push('API key is required')
    if (!r.apiSecret?.trim()) errors.push('API secret is required')
    if (!/^\d{6,12}$/.test(r.accountNumber?.trim() ?? ''))
      errors.push('DHL account number must be digits')
    if (!isValidPincode(r.originPincode?.trim())) errors.push('origin PIN code must be 6 digits')
    if (!r.originCity?.trim()) errors.push('origin city is required')
    const iec = r.iec?.trim()
    if (iec && !/^[A-Z0-9]{10}$/i.test(iec)) errors.push('IEC must be 10 letters or digits')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        apiKey: (r.apiKey as string).trim(),
        apiSecret: r.apiSecret as string,
        accountNumber: (r.accountNumber as string).trim(),
        originPincode: (r.originPincode as string).trim(),
        originCity: (r.originCity as string).trim(),
        iec: iec ? iec.toUpperCase() : undefined,
        mode: r.mode === 'live' ? 'live' : 'test',
        bookPickup: r.bookPickup !== 'false',
      },
    }
  },
  create: (config) => new DhlExpressProvider(config),
}
