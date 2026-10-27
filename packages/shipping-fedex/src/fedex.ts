/**
 * FedEx adapter (FedEx REST APIs), for exports from India: rates with transit times, shipment
 * with label and commercial invoice, a pickup request after booking, tracking and cancel.
 *
 * Endpoints, as FedEx's developer portal documents them (developer.fedex.com, API catalog);
 * the request and response shapes follow FedEx's published JSON samples for each API:
 *
 *   POST /oauth/token                    client_credentials -> bearer token (about an hour)
 *   POST /rate/v1/rates/quotes           one entry per service, with `returnTransitTimes`
 *   POST /ship/v1/shipments              AWB, base64 label and commercial invoice
 *   PUT  /ship/v1/shipments/cancel       cancel by tracking number
 *   POST /pickup/v1/pickups              courier pickup for the parcel just booked
 *   POST /track/v1/trackingnumbers       scans, latest status, estimated delivery
 *
 * Hosts: `https://apis-sandbox.fedex.com` (test) and `https://apis.fedex.com` (live); each
 * needs the API key and secret of a FedEx project of that kind, plus the merchant's FedEx
 * account number in every body.
 *
 * DECISIONS:
 *  - Exports only (`coverage: 'international'`): FedEx sold its domestic India business to
 *    Delhivery in 2021, so an Indian PIN code is answered "no" without a call.
 *  - Customs value and commodity prices in INR (the order's currency); `preferredCurrency`
 *    INR asks for rupee rates, and a rate in any other currency is dropped rather than shown
 *    as rupees. Duties are the recipient's (DAP), as for DHL Express.
 *  - The store's GSTIN goes on the shipper as a `BUSINESS_NATIONAL` TIN. FedEx's REST samples
 *    show no dedicated IEC field, so the IEC is printed on the commercial invoice in its
 *    special instructions ("IEC: ..."), where FedEx India's customs team reads it.
 *  - The label comes back base64 (`labelResponseOptions: LABEL`), with the commercial
 *    invoice, so the platform stores both as one PDF (`documents`).
 *  - The pickup request after booking is best effort: a failure never undoes the booking,
 *    and the merchant can call FedEx or book it on fedex.com.
 */

import { createHash } from 'node:crypto'
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
import { FEDEX_CAPABILITIES, FEDEX_LIVE_URL, FEDEX_TEST_URL } from './client'

export type FedexConfig = {
  /** The FedEx project's API key (OAuth client id). */
  clientId: string
  clientSecret: string
  /** Empty when connected for tracking only (inbound shipments): no quotes or bookings then. */
  accountNumber: string
  originPincode: string
  originCity: string
  /** Importer-Exporter Code, printed on the commercial invoice. */
  iec?: string | undefined
  mode: 'test' | 'live'
  /** Request a FedEx pickup right after each booking. */
  bookPickup: boolean
  fetchImpl?: typeof fetch | undefined
  now?: (() => Date) | undefined
}

const TRACKING_ONLY =
  'FedEx is connected for tracking only. Add your account number and origin PIN code and city in Apps → FedEx → Connect to ship with it.'

const QUICK_TIMEOUT_MS = 10_000
const BOOKING_TIMEOUT_MS = 30_000
const DEFAULT_SERVICE = 'FEDEX_INTERNATIONAL_PRIORITY'
const DEFAULT_BOX_CM = { length: 10, width: 10, height: 10 }

/** Tokens per FedEx project and mode, reused until a minute before they expire. */
const tokens = new Map<string, { token: string; expiresAt: number }>()

/** Clear the token cache (tests). */
export function clearFedexTokens(): void {
  tokens.clear()
}

type FedexError = { errors?: Array<{ code?: string; message?: string }> }

type RatedShipment = {
  rateType?: string
  currency?: string
  totalNetCharge?: number
  totalBaseCharge?: number
  totalVatCharge?: number
  shipmentRateDetail?: {
    totalFreightDiscount?: number
    surCharges?: Array<{ type?: string; amount?: number }>
    totalBillingWeight?: { units?: string; value?: number }
  }
}

type RateReplyDetail = {
  serviceType?: string
  serviceName?: string
  ratedShipmentDetails?: RatedShipment[]
  commit?: {
    transitDays?: { minimumTransitTime?: string }
    dateDetail?: { dayFormat?: string }
  }
  operationalDetail?: { transitTime?: string; deliveryDate?: string }
}

type RateResponse = { output?: { rateReplyDetails?: RateReplyDetail[] } }

type ShipDocument = { contentType?: string; docType?: string; encodedLabel?: string; url?: string }

type ShipResponse = {
  output?: {
    transactionShipments?: Array<{
      masterTrackingNumber?: string
      shipmentDocuments?: ShipDocument[]
      pieceResponses?: Array<{ trackingNumber?: string; packageDocuments?: ShipDocument[] }>
      completedShipmentDetail?: {
        shipmentRating?: {
          shipmentRateDetails?: Array<{ currency?: string; totalNetCharge?: number }>
        }
      }
    }>
  }
}

type TrackResult = {
  latestStatusDetail?: { code?: string; derivedCode?: string; description?: string }
  scanEvents?: Array<{
    date?: string
    eventType?: string
    derivedStatusCode?: string
    eventDescription?: string
    scanLocation?: { city?: string; countryCode?: string }
  }>
  dateAndTimes?: Array<{ type?: string; dateTime?: string }>
  error?: { code?: string; message?: string }
}

type TrackResponse = { output?: { completeTrackResults?: Array<{ trackResults?: TrackResult[] }> } }

/** FedEx's spelled-out transit times ("FOUR_DAYS") as a number. */
const TRANSIT_WORDS: Record<string, number> = {
  ONE_DAY: 1,
  TWO_DAYS: 2,
  THREE_DAYS: 3,
  FOUR_DAYS: 4,
  FIVE_DAYS: 5,
  SIX_DAYS: 6,
  SEVEN_DAYS: 7,
  EIGHT_DAYS: 8,
  NINE_DAYS: 9,
  TEN_DAYS: 10,
  ELEVEN_DAYS: 11,
  TWELVE_DAYS: 12,
  THIRTEEN_DAYS: 13,
  FOURTEEN_DAYS: 14,
  FIFTEEN_DAYS: 15,
}

/**
 * FedEx tracking status codes (`derivedStatusCode`/`eventType`), reduced to ours. Unknown codes
 * are movement scans (`in_transit`), never a guessed terminal state. A delivery exception (DE)
 * is still in transit: FedEx tries again or returns it, and says so with its own code.
 */
export function mapFedexStatus(code: string | undefined): ShipmentStatus {
  switch ((code ?? '').toUpperCase()) {
    case 'DL':
      return 'delivered'
    case 'OD':
      return 'out_for_delivery'
    case 'PU':
      return 'picked_up'
    case 'RS':
    case 'RP':
      return 'rto'
    case 'CA':
      return 'cancelled'
    case 'OC':
    case 'IN':
    case 'PX':
      return 'created'
    default:
      return 'in_transit'
  }
}

const kg = (grams: number) => Math.max(Math.round(grams / 10) / 100, 0.1)
const rupees = (paise: number) => Math.round(paise) / 100
const digits = (phone: string) => phone.replace(/\D/g, '').slice(-15)

function fedexAddress(a: ShipmentAddress) {
  const country = isDomesticCountry(a.country) ? 'IN' : a.country.trim().toUpperCase()
  const state = a.state?.trim()
  return {
    streetLines: wrapAddressLines([a.line1, a.line2], 35, 3),
    city: a.city.trim().slice(0, 35),
    ...(state && state.length <= 2 ? { stateOrProvinceCode: state.toUpperCase() } : {}),
    postalCode: a.pincode.trim(),
    countryCode: country,
  }
}

function serviceLabel(name: string | undefined, type: string): string {
  const cleaned = (name ?? '')
    .replace(/[®™Â]/g, '')
    .replace(/^FedEx\s+/i, '')
    .trim()
  return cleaned || type.toLowerCase().replace(/_/g, ' ')
}

export class FedexProvider implements ShippingProvider {
  readonly id = 'fedex'
  readonly label = 'FedEx'
  readonly coverage = 'international' as const

  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date
  private readonly tokenKey: string

  constructor(private readonly config: FedexConfig) {
    this.baseUrl = config.mode === 'live' ? FEDEX_LIVE_URL : FEDEX_TEST_URL
    this.fetchImpl = config.fetchImpl ?? fetch
    this.now = config.now ?? (() => new Date())
    // The secret is hashed into the key so a changed secret never reuses an old token.
    this.tokenKey = createHash('sha256')
      .update(`${config.mode}\0${config.clientId}\0${config.clientSecret}`)
      .digest('hex')
  }

  private async send(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new CourierError('timeout', this.id, `FedEx did not answer within ${timeoutMs}ms.`, {
          cause: error,
        })
      }
      throw new CourierError('unavailable', this.id, 'Could not reach FedEx.', { cause: error })
    }
  }

  /** A bearer token for this project, from the cache or a fresh client-credentials grant. */
  private async token(): Promise<string> {
    const cached = tokens.get(this.tokenKey)
    if (cached && cached.expiresAt > this.now().getTime()) return cached.token
    const res = await this.send(
      '/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
      },
      QUICK_TIMEOUT_MS,
    )
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      throw new CourierError('auth', this.id, 'FedEx rejected the API key or secret.', {
        status: res.status,
      })
    }
    if (!res.ok) {
      throw new CourierError('unavailable', this.id, `FedEx returned HTTP ${res.status}.`, {
        status: res.status,
      })
    }
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string
      expires_in?: number
    }
    if (!body.access_token)
      throw new CourierError('bad_response', this.id, 'FedEx sent no access token.')
    const lifetime = Math.max((body.expires_in ?? 3600) - 60, 30) * 1000
    tokens.set(this.tokenKey, {
      token: body.access_token,
      expiresAt: this.now().getTime() + lifetime,
    })
    return body.access_token
  }

  /** One authorised JSON call. A 4xx body is read: FedEx explains a refusal in `errors[]`. */
  private async call<T>(
    method: 'POST' | 'PUT',
    path: string,
    body: unknown,
    timeoutMs = QUICK_TIMEOUT_MS,
  ): Promise<T> {
    const token = await this.token()
    const res = await this.send(
      path,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-locale': 'en_US',
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    )
    if (res.status === 401 || res.status === 403) {
      tokens.delete(this.tokenKey)
      throw new CourierError('auth', this.id, 'FedEx rejected the credentials.', {
        status: res.status,
      })
    }
    if (res.status === 429) {
      throw new CourierError('rate_limited', this.id, 'FedEx is rate limiting us.', {
        status: res.status,
      })
    }
    const text = await res.text()
    if (!res.ok) {
      let problem: FedexError = {}
      try {
        problem = JSON.parse(text) as FedexError
      } catch {
        // An HTML error page: the status alone has to do.
      }
      const detail = (problem.errors ?? [])
        .map((e) => e.message)
        .filter(Boolean)
        .join(' ')
      throw new CourierError(
        res.status >= 500 ? 'unavailable' : 'rejected',
        this.id,
        detail ? `FedEx: ${detail}` : `FedEx returned HTTP ${res.status}.`,
        { status: res.status },
      )
    }
    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new CourierError('bad_response', this.id, 'FedEx returned a non-JSON body.', {
        cause: error,
      })
    }
  }

  private pickupType(): string {
    return this.config.bookPickup ? 'CONTACT_FEDEX_TO_SCHEDULE' : 'DROPOFF_AT_FEDEX_LOCATION'
  }

  private async rates(query: RateQuery): Promise<RateReplyDetail[]> {
    const weight = { units: 'KG', value: kg(query.weightGrams) }
    const data = await this.call<RateResponse>('POST', '/rate/v1/rates/quotes', {
      accountNumber: { value: this.config.accountNumber },
      rateRequestControlParameters: { returnTransitTimes: true },
      requestedShipment: {
        shipper: {
          address: {
            postalCode: this.config.originPincode,
            city: this.config.originCity,
            countryCode: 'IN',
          },
        },
        recipient: {
          address: {
            postalCode: query.destinationPincode.trim(),
            ...(query.destinationCity ? { city: query.destinationCity.trim().slice(0, 35) } : {}),
            countryCode: (query.destinationCountry as string).trim().toUpperCase(),
          },
        },
        pickupType: this.pickupType(),
        rateRequestType: ['ACCOUNT'],
        preferredCurrency: 'INR',
        shipDateStamp: indiaLocalTime(this.now()).slice(0, 10),
        requestedPackageLineItems: [
          { weight, dimensions: { ...(query.dimensionsCm ?? DEFAULT_BOX_CM), units: 'CM' } },
        ],
        customsClearanceDetail: {
          dutiesPayment: { paymentType: 'RECIPIENT' },
          commodities: [
            {
              description: 'Goods',
              quantity: 1,
              quantityUnits: 'PCS',
              weight,
              customsValue: { amount: rupees(query.declaredValuePaise), currency: 'INR' },
            },
          ],
        },
      },
    })
    return data.output?.rateReplyDetails ?? []
  }

  private transitDays(detail: RateReplyDetail): number | null {
    const word =
      detail.operationalDetail?.transitTime ?? detail.commit?.transitDays?.minimumTransitTime
    if (word && TRANSIT_WORDS[word]) return TRANSIT_WORDS[word] as number
    const date = detail.operationalDetail?.deliveryDate ?? detail.commit?.dateDetail?.dayFormat
    if (!date) return null
    const days = Math.ceil((new Date(date).getTime() - this.now().getTime()) / 86_400_000)
    return Number.isFinite(days) && days > 0 ? days : null
  }

  private toOption(detail: RateReplyDetail): RateOption | null {
    if (!detail.serviceType) return null
    const rated = detail.ratedShipmentDetails?.find(
      (r) => r.currency === 'INR' && typeof r.totalNetCharge === 'number',
    )
    if (!rated?.totalNetCharge || rated.totalNetCharge <= 0) return null
    const paise = (n: number | undefined) => Math.round((n ?? 0) * 100)
    const charges: RateCharge[] = []
    const freight =
      (rated.totalBaseCharge ?? 0) - (rated.shipmentRateDetail?.totalFreightDiscount ?? 0)
    if (freight > 0) charges.push({ kind: 'freight', pricePaise: paise(freight) })
    for (const s of rated.shipmentRateDetail?.surCharges ?? []) {
      if (!s.amount || s.amount <= 0) continue
      const kind = s.type === 'FUEL' ? 'fuel' : s.type === 'INSURED_VALUE' ? 'insurance' : 'other'
      charges.push({ kind, pricePaise: paise(s.amount) })
    }
    if (rated.totalVatCharge && rated.totalVatCharge > 0) {
      charges.push({ kind: 'gst', pricePaise: paise(rated.totalVatCharge) })
    }
    const billing = rated.shipmentRateDetail?.totalBillingWeight
    const days = this.transitDays(detail)
    return {
      serviceId: detail.serviceType,
      serviceLabel: serviceLabel(detail.serviceName, detail.serviceType),
      carrier: null,
      pricePaise: paise(rated.totalNetCharge),
      minTransitDays: days,
      maxTransitDays: days,
      codAvailable: false,
      charges,
      chargeableWeightGrams:
        billing?.value && billing.units === 'KG' ? Math.round(billing.value * 1000) : null,
    }
  }

  /** Account number and origin are set: quotes and bookings work, not just tracking. */
  private canShip(): boolean {
    return this.config.accountNumber !== '' && this.config.originPincode !== ''
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
      return closed('FedEx ships from India to other countries only.')
    }
    if (!this.canShip()) return closed(TRACKING_ONLY)
    const options = await this.quoteOptions({
      originPincode: query.originPincode,
      destinationPincode: query.destinationPincode,
      destinationCountry: query.destinationCountry,
      destinationCity: query.destinationCity,
      weightGrams: query.weightGrams ?? 500,
      declaredValuePaise: Math.round((query.declaredValue ?? 0) * 100),
      paymentMode: 'prepaid',
    })
    if (options.length === 0) return closed('FedEx offers no service to this address.')
    const days = options.map((o) => o.minTransitDays).filter((n): n is number => n !== null)
    return {
      provider: this.id,
      serviceable: true,
      codAvailable: false,
      prepaidAvailable: true,
      minTransitDays: days.length ? Math.min(...days) : null,
      maxTransitDays: days.length ? Math.max(...days) : null,
      reason: null,
    }
  }

  async quoteOptions(query: RateQuery): Promise<RateOption[]> {
    if (isDomesticCountry(query.destinationCountry) || !this.canShip()) return []
    const details = await this.rates(query)
    return details.flatMap((d) => this.toOption(d) ?? [])
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
        missingHsCodeMessage('FedEx', customs.missingHsCode),
      )
    }
    const gstin = input.exporterGstin?.trim()
    const iec = this.config.iec?.trim()
    const value = { amount: rupees(input.valuePaise), currency: 'INR' }
    return {
      labelResponseOptions: 'LABEL',
      accountNumber: { value: this.config.accountNumber },
      requestedShipment: {
        shipDatestamp: indiaLocalTime(this.now()).slice(0, 10),
        serviceType: input.serviceId || DEFAULT_SERVICE,
        packagingType: 'YOUR_PACKAGING',
        pickupType: this.pickupType(),
        shipper: {
          contact: {
            personName: input.from.name.slice(0, 70),
            companyName: input.from.name.slice(0, 35),
            phoneNumber: digits(input.from.phone),
          },
          address: fedexAddress({ ...input.from, country: 'IN' }),
          ...(gstin ? { tins: [{ number: gstin, tinType: 'BUSINESS_NATIONAL' }] } : {}),
        },
        recipients: [
          {
            contact: {
              personName: input.to.name.slice(0, 70),
              phoneNumber: digits(input.to.phone),
            },
            address: { ...fedexAddress(input.to), residential: true },
          },
        ],
        shippingChargesPayment: { paymentType: 'SENDER' },
        labelSpecification: { imageType: 'PDF', labelStockType: 'PAPER_85X11_TOP_HALF_LABEL' },
        customsClearanceDetail: {
          dutiesPayment: { paymentType: 'RECIPIENT' },
          isDocumentOnly: false,
          totalCustomsValue: value,
          commercialInvoice: {
            shipmentPurpose: 'SOLD',
            termsOfSale: 'DAP',
            customerReferences: [
              { customerReferenceType: 'INVOICE_NUMBER', value: String(input.orderNumber) },
            ],
            ...(iec ? { specialInstructions: `IEC: ${iec}` } : {}),
          },
          commodities: customs.lines.map((l) => ({
            description: l.title.slice(0, 450),
            countryOfManufacture: l.countryOfOrigin,
            harmonizedCode: l.hsCode,
            quantity: l.quantity,
            quantityUnits: 'PCS',
            unitPrice: { amount: rupees(l.unitPricePaise), currency: 'INR' },
            customsValue: { amount: rupees(l.unitPricePaise * l.quantity), currency: 'INR' },
            weight: { units: 'KG', value: kg(l.unitWeightGrams * l.quantity) },
          })),
        },
        shippingDocumentSpecification: {
          shippingDocumentTypes: ['COMMERCIAL_INVOICE'],
          commercialInvoiceDetail: {
            documentFormat: { docType: 'PDF', stockType: 'PAPER_LETTER' },
          },
        },
        requestedPackageLineItems: [
          {
            weight: { units: 'KG', value: kg(input.weightGrams) },
            dimensions: { ...(input.dimensionsCm ?? DEFAULT_BOX_CM), units: 'CM' },
            customerReferences: [
              { customerReferenceType: 'CUSTOMER_REFERENCE', value: `Order ${input.orderNumber}` },
            ],
          },
        ],
      },
    }
  }

  /**
   * Ask FedEx to collect this parcel: today when booked before 3 pm in India, else tomorrow
   * from 10 am. Best effort, see the file header.
   */
  private async requestPickup(input: CreateShipmentInput, trackingNumber: string): Promise<void> {
    const local = indiaLocalTime(this.now())
    const hour = Number(local.slice(11, 13))
    const sameDay = hour < 15
    const ready = sameDay
      ? new Date(this.now().getTime() + 30 * 60_000)
      : new Date(`${indiaLocalTime(this.now(), 24 * 60).slice(0, 10)}T10:00:00+05:30`)
    await this.call('POST', '/pickup/v1/pickups', {
      associatedAccountNumber: { value: this.config.accountNumber },
      originDetail: {
        pickupLocation: {
          contact: {
            personName: input.from.name.slice(0, 70),
            companyName: input.from.name.slice(0, 35),
            phoneNumber: digits(input.from.phone),
          },
          address: fedexAddress({ ...input.from, country: 'IN' }),
        },
        readyDateTimestamp: `${ready.toISOString().slice(0, 19)}Z`,
        customerCloseTime: '18:00:00',
        pickupDateType: sameDay ? 'SAME_DAY' : 'FUTURE_DAY',
        packageLocation: 'FRONT',
      },
      carrierCode: 'FDXE',
      countryRelationships: 'INTERNATIONAL',
      totalWeight: { units: 'KG', value: kg(input.weightGrams) },
      packageCount: 1,
      trackingNumber,
    })
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (isDomesticCountry(input.to.country)) {
      throw new CourierError(
        'rejected',
        this.id,
        'FedEx ships from India to other countries only. Book this order with a domestic courier.',
      )
    }
    if (input.paymentMode === 'cod') {
      throw new CourierError('rejected', this.id, 'FedEx exports cannot collect cash on delivery.')
    }
    if (!this.canShip()) throw new CourierError('rejected', this.id, TRACKING_ONLY)
    const data = await this.call<ShipResponse>(
      'POST',
      '/ship/v1/shipments',
      this.buildShipmentPayload(input),
      BOOKING_TIMEOUT_MS,
    )
    const shipment = data.output?.transactionShipments?.[0]
    const waybill = shipment?.masterTrackingNumber ?? shipment?.pieceResponses?.[0]?.trackingNumber
    if (!shipment || !waybill) {
      throw new CourierError(
        'bad_response',
        this.id,
        'FedEx booked nothing: no tracking number came back.',
      )
    }
    const toDoc = (d: ShipDocument): ShipmentDocument[] =>
      d.encodedLabel && (d.docType ?? 'PDF').toUpperCase() === 'PDF'
        ? [
            {
              kind:
                d.contentType === 'LABEL'
                  ? 'label'
                  : d.contentType === 'COMMERCIAL_INVOICE'
                    ? 'commercial_invoice'
                    : 'other',
              pdfBase64: d.encodedLabel,
            },
          ]
        : []
    const documents = [
      ...(shipment.pieceResponses ?? []).flatMap((p) => (p.packageDocuments ?? []).flatMap(toDoc)),
      ...(shipment.shipmentDocuments ?? []).flatMap(toDoc),
    ]
    const labelUrl = shipment.pieceResponses?.[0]?.packageDocuments?.find((d) => d.url)?.url
    const charge = shipment.completedShipmentDetail?.shipmentRating?.shipmentRateDetails?.find(
      (r) => r.currency === 'INR' && typeof r.totalNetCharge === 'number',
    )?.totalNetCharge
    if (this.config.bookPickup) await this.requestPickup(input, waybill).catch(() => undefined)
    return {
      waybill,
      providerRef: waybill,
      ...(documents.length ? { documents } : labelUrl ? { labelUrl } : {}),
      ...(charge && charge > 0 ? { chargePaise: Math.round(charge * 100) } : {}),
    }
  }

  async track(waybill: string): Promise<Tracking> {
    const data = await this.call<TrackResponse>('POST', '/track/v1/trackingnumbers', {
      includeDetailedScans: true,
      trackingInfo: [{ trackingNumberInfo: { trackingNumber: waybill } }],
    })
    const result = data.output?.completeTrackResults?.[0]?.trackResults?.[0]
    if (!result || result.error) {
      throw new CourierError(
        'bad_response',
        this.id,
        result?.error?.message
          ? `FedEx: ${result.error.message}`
          : 'FedEx has no record of this tracking number.',
      )
    }
    const events: TrackingEvent[] = (result.scanEvents ?? []).map((e) => {
      const at = new Date(e.date ?? 0)
      const place = [e.scanLocation?.city, e.scanLocation?.countryCode].filter(Boolean).join(', ')
      return {
        at: Number.isNaN(at.getTime()) ? new Date(0).toISOString() : at.toISOString(),
        status: mapFedexStatus(e.derivedStatusCode || e.eventType),
        description: e.eventDescription || e.eventType || '',
        ...(place ? { location: place } : {}),
      }
    })
    events.sort((a, b) => a.at.localeCompare(b.at))
    const latest = result.latestStatusDetail
    const expected = result.dateAndTimes?.find((d) => d.type === 'ESTIMATED_DELIVERY')?.dateTime
    return {
      waybill,
      status: latest
        ? mapFedexStatus(latest.derivedCode || latest.code)
        : (events.at(-1)?.status ?? 'created'),
      events,
      trackingUrl: `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(waybill)}`,
      ...(expected ? { expectedDate: expected.slice(0, 10) } : {}),
    }
  }

  async cancel(waybill: string): Promise<void> {
    const data = await this.call<{ output?: { cancelledShipment?: boolean; message?: string } }>(
      'PUT',
      '/ship/v1/shipments/cancel',
      {
        accountNumber: { value: this.config.accountNumber },
        senderCountryCode: 'IN',
        deletionControl: 'DELETE_ALL_PACKAGES',
        trackingNumber: waybill,
      },
    )
    if (!data.output?.cancelledShipment) {
      throw new CourierError(
        'rejected',
        this.id,
        `FedEx did not cancel the shipment${data.output?.message ? `: ${data.output.message}` : '.'}`,
      )
    }
  }

  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      tokens.delete(this.tokenKey)
      await this.token()
      return {
        ok: true,
        message: `Connected to FedEx (${this.config.mode === 'live' ? 'live' : 'test'}). The API key and secret work.`,
      }
    } catch (error) {
      if (error instanceof CourierError && error.kind === 'auth') {
        return {
          ok: false,
          message:
            'FedEx did not accept this API key and secret. Copy both again from your project on developer.fedex.com, and check Test or Live matches the project.',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify FedEx credentials.',
      }
    }
  }
}

const fields: ProviderField[] = [
  {
    key: 'clientId',
    label: 'API key',
    required: true,
    help: 'From your project on developer.fedex.com.',
  },
  { key: 'clientSecret', label: 'Secret key', secret: true, required: true },
  {
    key: 'accountNumber',
    label: 'FedEx account number',
    help: 'The 9-digit account shipments are billed to. Leave empty, with the origin, to use FedEx for tracking only.',
  },
  { key: 'originPincode', label: 'Origin PIN code' },
  { key: 'originCity', label: 'Origin city' },
  {
    key: 'iec',
    label: 'IEC (Importer-Exporter Code)',
    help: 'Printed on the commercial invoice. 10 characters, from DGFT.',
  },
  {
    key: 'mode',
    label: 'Test or live',
    help: "'test' uses FedEx's sandbox; 'live' books real shipments.",
  },
  { key: 'bookPickup', label: 'Request a pickup after each booking', type: 'boolean' },
]

export const fedexFactory: ShippingProviderFactory<FedexConfig> = {
  id: 'fedex',
  label: 'FedEx',
  fields,
  capabilities: FEDEX_CAPABILITIES,
  validateConfig(raw) {
    const r = (raw ?? {}) as Record<string, string | undefined>
    const errors: string[] = []
    if (!r.clientId?.trim()) errors.push('API key is required')
    if (!r.clientSecret?.trim()) errors.push('secret key is required')
    const accountNumber = r.accountNumber?.trim() ?? ''
    const originPincode = r.originPincode?.trim() ?? ''
    const originCity = r.originCity?.trim() ?? ''
    // All three empty = tracking only (inbound shipments). Any one given = shipping, so all three.
    const shipping = accountNumber !== '' || originPincode !== '' || originCity !== ''
    if (shipping) {
      if (!/^\d{9,12}$/.test(accountNumber)) errors.push('FedEx account number must be 9 digits')
      if (!isValidPincode(originPincode)) errors.push('origin PIN code must be 6 digits')
      if (!originCity) errors.push('origin city is required')
    }
    const iec = r.iec?.trim()
    if (iec && !/^[A-Z0-9]{10}$/i.test(iec)) errors.push('IEC must be 10 letters or digits')
    if (errors.length) return { ok: false, errors }
    return {
      ok: true,
      config: {
        clientId: (r.clientId as string).trim(),
        clientSecret: r.clientSecret as string,
        accountNumber,
        originPincode,
        originCity,
        iec: iec ? iec.toUpperCase() : undefined,
        mode: r.mode === 'live' ? 'live' : 'test',
        bookPickup: r.bookPickup !== 'false',
      },
    }
  },
  create: (config) => new FedexProvider(config),
}
