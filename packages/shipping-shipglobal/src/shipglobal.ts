/**
 * ShipGlobal adapter, for exports from India: books an order and returns its label.
 *
 * Built on the only API ShipGlobal publishes, the Label Generation API
 * (https://labels.shipglobal.in/api-docs.php, read 2026-10-31):
 *
 *   POST /customers.php                     {email,password} -> {token, expires_at, customer}
 *   POST /addOrder.php?download=true        order + items -> {success, data.waybill_number,
 *                                           data.pdf_base64, data.label_format}
 *
 * The docs list no rate, tracking, cancel, pickup or webhook call, and none is guessed here:
 *  - Rates: none. The rate table shows ShipGlobal with transit and price unknown ("rate on
 *    booking"); serviceability is answered from the service rules without a call.
 *  - Tracking: none. `tracksManually`, so the poll job skips it and the merchant moves each
 *    parcel's status on the app page, reading ShipGlobal's tracker.
 *  - Cancel: none. Not in the capabilities; the merchant cancels in ShipGlobal's panel.
 *  - `/processDestination.php` (manifest handoff) exists for the UBI service only and is for
 *    ShipGlobal's carrier partners, so it is not used.
 *
 * Every field the docs do not explain, and how this adapter fills it, carries a `VERIFY:`
 * note; the handoff note lists them for the owner to confirm with ShipGlobal's integration team.
 *
 * DECISIONS:
 *  - Exports only (`coverage: 'international'`), prepaid only (no COD), DAP.
 *  - `?download=true` on every booking: the docs make the same `order_reference` +
 *    `invoice_no` pair return the saved label instead of a 409, so a retry after a timeout
 *    gets the same waybill rather than a second booking. `order_reference` is our order id
 *    (a UUID), never the order number, so a ShipGlobal account also used from Shopify (same
 *    order numbers) can never hand back that store's label.
 *  - A failed booking still answers HTTP 200 with `success: false` (the docs say so): the
 *    `error` text is what the merchant reads.
 *  - UPS answers with a GIF label (the docs say so); it is not stored, since labels are
 *    stored and joined as PDFs. The booking stands and the merchant prints from ShipGlobal.
 *  - The bearer token lives in memory only (`LoginTokenCache`), never in the database.
 */

import {
  CourierError,
  type CreateShipmentInput,
  type CreateShipmentResult,
  type CredentialCheck,
  customsLines,
  indiaLocalTime,
  isDomesticCountry,
  LoginTokenCache,
  missingHsCodeMessage,
  type Serviceability,
  type ServiceabilityQuery,
  type ShippingProvider,
  type Tracking,
} from '@commerce/shipping'
import { SHIPGLOBAL_API_URL, SHIPGLOBAL_TRACKING_PAGE, type ShipglobalServiceCode } from './client'
import {
  cm,
  phoneOf,
  rupees,
  shipglobalService,
  splitName,
  streetLines,
  tokenLifetimeMs,
} from './mapping'

export type ShipglobalConfig = {
  /** The API login from ShipGlobal's dashboard (Settings › API). */
  email: string
  password: string
  /** `seller_nickname` on every order. VERIFY: what ShipGlobal expects here. */
  sellerNickname: string
  originPincode: string
  originCity: string
  /** Importer-Exporter Code, 10 characters from DGFT. */
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

type LoginResponse = {
  token?: string
  expires_at?: string
  customer?: { id?: number; name?: string; email?: string }
  error?: string
  message?: string
}

type AddOrderResponse = {
  success?: boolean
  label?: string
  error?: string
  data?: {
    order_number?: string
    waybill_number?: string
    pdf_base64?: string
    label_format?: string
  }
}

export class ShipglobalProvider implements ShippingProvider {
  readonly id = 'shipglobal'
  readonly label = 'ShipGlobal'
  readonly coverage = 'international' as const
  readonly tracksManually = true

  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date
  private readonly tokens: LoginTokenCache

  constructor(private readonly config: ShipglobalConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch
    this.now = config.now ?? (() => new Date())
    this.tokens = new LoginTokenCache(() => this.login())
  }

  /**
   * One ShipGlobal call. A 4xx body is read for its `error`, which is what the merchant needs
   * to fix a refused booking. The URL and body never go into a message, and neither does the
   * token or password.
   */
  private async call<T>(
    path: string,
    body: unknown,
    options: { token?: string; query?: Record<string, string>; timeoutMs?: number } = {},
  ): Promise<T> {
    const qs = options.query ? `?${new URLSearchParams(options.query).toString()}` : ''
    const timeoutMs = options.timeoutMs ?? QUICK_TIMEOUT_MS
    let res: Response
    try {
      res = await this.fetchImpl(`${SHIPGLOBAL_API_URL}${path}${qs}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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
    // VERIFY: the docs list no status for a bad or lapsed token; 401/403 is assumed.
    if (res.status === 401 || res.status === 403) {
      throw new CourierError('auth', this.id, 'ShipGlobal rejected the API login.', {
        status: res.status,
      })
    }
    if (res.status === 429) {
      throw new CourierError('rate_limited', this.id, 'ShipGlobal is rate limiting us.', {
        status: res.status,
      })
    }
    const text = await res.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : {}
    } catch (error) {
      if (!res.ok) {
        throw new CourierError(
          res.status >= 500 ? 'unavailable' : 'rejected',
          this.id,
          `ShipGlobal returned HTTP ${res.status}.`,
          { status: res.status },
        )
      }
      throw new CourierError('bad_response', this.id, 'ShipGlobal returned a non-JSON body.', {
        cause: error,
      })
    }
    if (!res.ok) {
      const reason =
        (parsed as { error?: string; message?: string }).error ??
        (parsed as { message?: string }).message
      throw new CourierError(
        res.status >= 500 ? 'unavailable' : 'rejected',
        this.id,
        reason ? `ShipGlobal: ${reason}` : `ShipGlobal returned HTTP ${res.status}.`,
        { status: res.status },
      )
    }
    return parsed as T
  }

  private async login(): Promise<{ token: string; lifetimeMs: number }> {
    const data = await this.call<LoginResponse>('/customers.php', {
      email: this.config.email,
      password: this.config.password,
    })
    // VERIFY: a wrong password's answer. The docs show only the success body; no token = refused.
    if (!data.token) {
      throw new CourierError('auth', this.id, 'ShipGlobal did not accept this API login.')
    }
    return { token: data.token, lifetimeMs: tokenLifetimeMs(data.expires_at, this.now()) }
  }

  async checkServiceability(query: ServiceabilityQuery): Promise<Serviceability> {
    const answer = (serviceable: boolean, reason: string | null): Serviceability => ({
      provider: this.id,
      serviceable,
      codAvailable: false,
      prepaidAvailable: serviceable,
      // ShipGlobal publishes no transit times for its API.
      minTransitDays: null,
      maxTransitDays: null,
      reason,
    })
    if (isDomesticCountry(query.destinationCountry)) {
      return answer(false, 'ShipGlobal ships from India to other countries only.')
    }
    const service = shipglobalService(
      undefined,
      this.config.service,
      query.destinationCountry ?? '',
      query.weightGrams ?? 500,
    )
    return service
      ? answer(true, null)
      : answer(false, 'Your ShipGlobal service (USPS / UPS) delivers in the US only.')
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
    const service = shipglobalService(
      input.serviceId,
      this.config.service,
      input.to.country,
      input.weightGrams,
    )
    if (!service) {
      throw new CourierError(
        'rejected',
        this.id,
        'ShipGlobal books USPS and UPS to the US only. Pick another ShipGlobal service on the Connect page.',
      )
    }
    const seller = splitName(input.from.name)
    const buyer = splitName(input.to.name)
    const [sellerLine1, sellerLine2, sellerLine3] = streetLines(input.from)
    const [buyerLine1, buyerLine2, buyerLine3] = streetLines(input.to)
    const box = input.dimensionsCm ?? DEFAULT_BOX_CM
    const gstin = input.exporterGstin?.trim()
    const iec = this.config.iec?.trim()
    const ioss = this.config.iossNumber?.trim()
    const toCountry = input.to.country.trim().toUpperCase()
    return {
      service,
      payload: {
        invoice_no: String(input.orderNumber),
        invoice_date: indiaLocalTime(this.now()).slice(0, 10),
        // VERIFY: the longest order_reference ShipGlobal takes (a UUID is 36 characters).
        order_reference: input.orderId,
        service,
        package_weight: Math.max(Math.round(input.weightGrams), 1),
        package_length: cm(box.length),
        package_breadth: cm(box.width),
        package_height: cm(box.height),
        // VERIFY: the docs' sample sends EUR; we declare the order's rupees.
        currency_code: 'INR',
        // VERIFY: 1 is read as "export under CSB-V" (the e-commerce courier shipping bill).
        csb5_status: 1,
        seller_nickname: this.config.sellerNickname,
        seller_firstname: seller.first,
        seller_lastname: seller.last,
        seller_mobile: phoneOf(input.from.phone, 'IN'),
        // VERIFY: the parcel's seller email. The API login's email is the one we have.
        seller_email: this.config.email,
        seller_company: input.from.name,
        seller_address: sellerLine1,
        seller_address_2: sellerLine2,
        ...(sellerLine3 ? { seller_address_3: sellerLine3 } : {}),
        seller_city: input.from.city,
        seller_postcode: input.from.pincode.trim(),
        seller_country_code: 'IN',
        seller_state: input.from.state || input.from.city,
        // VERIFY: the tax id type ShipGlobal expects for an Indian GSTIN (the sample says VAT).
        ...(gstin ? { seller_tax_id_type: 'GSTIN', seller_tax_id: gstin } : {}),
        // VERIFY: the docs name no IEC field; `iec_number` is our guess.
        ...(iec ? { iec_number: iec } : {}),
        customer_shipping_firstname: buyer.first,
        customer_shipping_lastname: buyer.last,
        customer_shipping_mobile: phoneOf(input.to.phone, toCountry),
        // The shopper's email when the order has one; the seller's stands in otherwise.
        customer_shipping_email: input.to.email || this.config.email,
        customer_shipping_company: input.to.name,
        customer_shipping_address: buyerLine1,
        customer_shipping_address_2: buyerLine2,
        ...(buyerLine3 ? { customer_shipping_address_3: buyerLine3 } : {}),
        customer_shipping_city: input.to.city,
        customer_shipping_postcode: input.to.pincode.trim(),
        customer_shipping_country_code: toCountry,
        customer_shipping_state: input.to.state || input.to.city,
        ...(ioss ? { ioss_number: ioss } : {}),
        vendor_order_items: customs.lines.map((l, i) => ({
          vendor_order_item_name: l.title.slice(0, 200),
          vendor_order_item_sku: l.sku?.trim() || `LINE-${i + 1}`,
          vendor_order_item_quantity: l.quantity,
          vendor_order_item_unit_price: rupees(l.unitPricePaise),
          vendor_order_item_hsn: l.hsCode,
          // VERIFY: exports under a LUT are zero-rated, so 0; ask if ShipGlobal wants the IGST rate.
          vendor_order_item_tax_rate: 0,
        })),
        // VERIFY: the docs mark `tracking` mandatory with a sample number and no description;
        // we send the order reference.
        tracking: input.trackingNumber?.trim() || input.orderId,
        // The docs' sample values, mandatory for VipParcel only.
        ...(service === 'VIPPARCEL'
          ? { mailClass: 'First', deliveryConfirmation: 'NO_SIGNATURE' }
          : {}),
        retry: false,
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
    const result = await this.tokens.withToken((token) =>
      this.call<AddOrderResponse>('/addOrder.php', payload, {
        token,
        query: { download: 'true' },
        timeoutMs: BOOKING_TIMEOUT_MS,
      }),
    )
    const waybill = result.data?.waybill_number?.trim()
    if (result.success !== true || !waybill) {
      throw new CourierError(
        'rejected',
        this.id,
        result.error
          ? `ShipGlobal: ${result.error}`
          : 'ShipGlobal booked nothing: no waybill came back.',
      )
    }
    const pdf =
      result.data?.pdf_base64 && (result.data.label_format ?? 'PDF').toUpperCase() === 'PDF'
        ? result.data.pdf_base64
        : null
    return {
      waybill,
      providerRef: result.data?.order_number || waybill,
      trackingUrl: SHIPGLOBAL_TRACKING_PAGE,
      ...(pdf ? { documents: [{ kind: 'label' as const, pdfBase64: pdf }] } : {}),
    }
  }

  /** The published API has no tracking call; `tracksManually` keeps the poll job away. */
  async track(_waybill: string): Promise<Tracking> {
    throw new CourierError(
      'rejected',
      this.id,
      'ShipGlobal sends no tracking to apps. Check the parcel on shipglobal.in/tracking and set its status on the ShipGlobal app page.',
    )
  }

  /** The published API has no cancel call (`cancel` is not in the capabilities). */
  async cancel(_waybill: string): Promise<void> {
    throw new CourierError(
      'rejected',
      this.id,
      'Cancel this label in your ShipGlobal panel; ShipGlobal has no cancel for apps.',
    )
  }

  /** Signs in: the login is read-only and is the whole of what the key check needs. */
  async verifyCredentials(): Promise<CredentialCheck> {
    try {
      const data = await this.call<LoginResponse>('/customers.php', {
        email: this.config.email,
        password: this.config.password,
      })
      if (!data.token) {
        return {
          ok: false,
          message:
            'ShipGlobal did not accept this API login. Copy it again from ShipGlobal › Settings › API.',
        }
      }
      const who = data.customer?.name?.trim()
      return {
        ok: true,
        message: `Connected to ShipGlobal${who ? ` as ${who}` : ''}. Labels are booked with ${this.config.service}.`,
      }
    } catch (error) {
      if (error instanceof CourierError && (error.kind === 'auth' || error.kind === 'rejected')) {
        return {
          ok: false,
          message:
            'ShipGlobal did not accept this API login. Copy it again from ShipGlobal › Settings › API.',
        }
      }
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Could not verify the ShipGlobal login.',
      }
    }
  }
}
