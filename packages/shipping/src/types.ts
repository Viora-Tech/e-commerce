/**
 * The shipping contract. Couriers (Delhivery, Shiprocket, a demo adapter)
 * implement it; the platform asks every enabled provider the same questions
 * and never learns how differently the underlying APIs are shaped.
 *
 * Two families of question live here:
 *
 *  - Before the order: "can you take a parcel from this pincode to that one,
 *    and how long will it take?" (serviceability + transit days). Transit
 *    days are the provider's ONLY output about timing. Turning days into a
 *    calendar date is the job of delivery-date.ts, kept out of adapters on
 *    purpose: couriers disagree about days, but there is only one right way
 *    to add a day to a calendar.
 *  - After the order: create a shipment (waybill + label), track it, cancel it.
 */

export type ServiceabilityQuery = {
  originPincode: string
  destinationPincode: string
  /**
   * Parcel weight in grams. Optional because a variant may have no weight.
   * Adapters that need one substitute a documented default rather than
   * sending 0, which some APIs treat as "quote me nothing".
   */
  weightGrams?: number | null | undefined
  /** Order value in rupees, for aggregators that quote insurance against it. */
  declaredValue?: number | null | undefined
  /**
   * ISO 3166-1 alpha-2 of the destination; absent means India. Only couriers with
   * `coverage` 'international' or 'both' are asked about a foreign address, and then
   * `destinationPincode` holds that country's postal code.
   */
  destinationCountry?: string | undefined
  /** Destination city, which some international rate APIs want next to the postal code. */
  destinationCity?: string | undefined
}

export type Serviceability = {
  /** Which adapter produced this. Stored in the cache key and echoed for support. */
  provider: string
  /** Whether the courier will carry a parcel to this pincode at all. */
  serviceable: boolean
  /** Cash on delivery available *at the courier*. Merchant policy is applied later. */
  codAvailable: boolean
  /** Prepaid shipments accepted. Rarely false, but Delhivery does report it. */
  prepaidAvailable: boolean
  /**
   * Transit time in days, or null when the courier does not tell us.
   * Delhivery's serviceability endpoint genuinely does not return one, so
   * null is a real, common answer and callers must fall back to the
   * merchant's configured transit days, never treat it as zero.
   */
  minTransitDays: number | null
  maxTransitDays: number | null
  /** Why not serviceable, when the API says. Never shown raw to customers. */
  reason: string | null
}

export type ShipmentAddress = {
  name: string
  line1: string
  line2?: string | undefined
  city: string
  state: string
  pincode: string
  country: string
  phone: string
}

export type ShipmentLine = {
  title: string
  quantity: number
  unitPricePaise: number
  /** Customs fields for a parcel going abroad (the variant's HS code, made-in country). */
  hsCode?: string | undefined
  /** ISO 3166-1 alpha-2; absent on an international booking means India. */
  countryOfOrigin?: string | undefined
  sku?: string | undefined
  /** One unit's weight, when the variant has one; customs lines need a weight each. */
  unitWeightGrams?: number | undefined
}

export type CreateShipmentInput = {
  orderId: string
  /** Human order number; couriers print it on the label and echo it in tracking. */
  orderNumber: number
  to: ShipmentAddress
  /** Where the parcel goes back to on RTO. */
  from: ShipmentAddress
  /**
   * The pickup location (warehouse) name registered on the courier for the location the
   * parcel leaves from. Absent: the courier account's own pickup location, as configured.
   */
  pickupLocationName?: string | undefined
  lines: ShipmentLine[]
  paymentMode: 'prepaid' | 'cod'
  /** Amount to collect on delivery, in paise. 0 for prepaid. */
  codAmountPaise: number
  /** Declared value for insurance and customs, in paise. */
  valuePaise: number
  weightGrams: number
  /**
   * The service picked from `quoteOptions` (`RateOption.serviceId`): Delhivery's mode, an
   * aggregator's courier. Absent: the courier's own default, as before.
   */
  serviceId?: string | undefined
  /**
   * The tracking number the merchant already has, for a courier booked outside the platform
   * (India Post at the post office counter: the article number on the receipt). Only couriers
   * with `requiresTrackingNumber` read it; the rest issue their own.
   */
  trackingNumber?: string | undefined
  /** The parcel's box, when known. Domestic adapters may ignore it; international rates need it. */
  dimensionsCm?: { length: number; width: number; height: number } | undefined
  /** The store's GSTIN, printed on an export's commercial invoice. */
  exporterGstin?: string | undefined
}

export type CreateShipmentResult = {
  /** Courier's tracking number (AWB). */
  waybill: string
  labelUrl?: string | undefined
  /** Whatever id the courier gave us for support queries; often the waybill again. */
  providerRef: string
  /** What the courier charges for this consignment, when its booking answer says (paise). */
  chargePaise?: number | undefined
  /** Public page a shopper can open, when the courier names it at booking (before any scan). */
  trackingUrl?: string | undefined
  /**
   * The label itself, for a courier that hands back the PDF rather than a public link (Blue
   * Dart's waybill answer carries it; DTDC streams it behind the API key). The platform keeps
   * it in the store's private storage and points `labelUrl` at the admin's own download, so a
   * courier credential never ends up in a link. Ignored when `labelUrl` is set.
   */
  labelDocument?: ShippingLabelDocument | undefined
  /**
   * The label and, abroad, the commercial invoice as base64 PDFs, for couriers that hand back
   * several files (DHL Express, FedEx). The platform joins them label-first into one PDF and
   * keeps it exactly like `labelDocument`. Ignored when `labelUrl` or `labelDocument` is set.
   */
  documents?: ShipmentDocument[] | undefined
  /**
   * The courier serves the label only behind the merchant's API key (Delhivery's packing slip):
   * there is no link a browser can open. The platform points `labelUrl` at the admin's own
   * download route, which asks the adapter's `getLabel` server-side, so the key never reaches
   * the browser. Ignored when `labelUrl`, `labelDocument` or `documents` is set.
   */
  labelViaProvider?: boolean | undefined
}

export type ShippingLabelDocument = {
  contentType: 'application/pdf'
  body: Uint8Array
}

export type ShipmentDocument = {
  kind: 'label' | 'commercial_invoice' | 'other'
  pdfBase64: string
}

export type ShipmentStatus =
  | 'created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'rto'
  | 'cancelled'

export type TrackingEvent = {
  /** ISO instant. */
  at: string
  status: ShipmentStatus
  /** Courier's own wording ("Bag Received at Facility"). */
  description: string
  location?: string | undefined
}

export type Tracking = {
  waybill: string
  status: ShipmentStatus
  /** Oldest first. */
  events: TrackingEvent[]
  /** Public page a shopper can open. */
  trackingUrl?: string | undefined
  /** Courier's promised date when it gives one, "YYYY-MM-DD". */
  expectedDate?: string | undefined
}

export type CredentialCheck = {
  ok: boolean
  /** Shown verbatim in the admin settings page. Must be actionable. */
  message: string
}

export type RateQuery = {
  originPincode: string
  destinationPincode: string
  weightGrams: number
  /** Goods value after discounts, in paise. */
  declaredValuePaise: number
  paymentMode: 'prepaid' | 'cod'
  /** ISO 3166-1 alpha-2; absent means India. See `ServiceabilityQuery.destinationCountry`. */
  destinationCountry?: string | undefined
  destinationCity?: string | undefined
  /** The parcel's box, for couriers that price by volumetric weight themselves. */
  dimensionsCm?: { length: number; width: number; height: number } | undefined
}

/** A courier's own price for one parcel. Never shown raw; the platform names and rounds it. */
export type RateQuote = {
  pricePaise: number
  minTransitDays: number | null
  maxTransitDays: number | null
}

/** One line of a quoted price, only as the courier's answer itemised it. */
export type RateCharge = {
  kind: 'freight' | 'cod' | 'fuel' | 'insurance' | 'rto' | 'other' | 'gst'
  pricePaise: number
}

/**
 * One bookable service on a route: Delhivery Surface or Express, or one carrier inside an
 * aggregator (Shiprocket, RapidShyp). `serviceId` goes back into `createShipment` so the
 * merchant books what they picked, not the courier's default.
 */
export type RateOption = {
  serviceId: string
  /** "Surface", "Express", or an aggregator's service name ("Bluedart Air"). */
  serviceLabel: string
  /** The carrier behind an aggregator's option ("Delhivery"); null for a direct courier. */
  carrier: string | null
  /** Total for the parcel, tax included, in paise. */
  pricePaise: number
  minTransitDays: number | null
  maxTransitDays: number | null
  /** Null when the courier's answer does not say. */
  codAvailable: boolean | null
  /** What the courier itemised; empty when it gave a total only. */
  charges: RateCharge[]
  /** The weight the courier charges for, when it says. */
  chargeableWeightGrams: number | null
}

/**
 * What an adapter can actually do. Declared on the factory (`capabilities`)
 * so the admin can grey out "Schedule pickup" for a courier that has no
 * pickup method rather than let the click 404 or throw. An adapter with a
 * method present but genuinely unverified against the courier's docs should
 * still list the capability (so the UI offers it) but the method itself
 * should say in a comment that it is best-effort/unconfirmed - see
 * packages/shipping-delhivery for the worked example.
 */
export type ShippingCapability =
  | 'serviceability'
  | 'rates'
  | 'create_shipment'
  | 'label'
  | 'pickup'
  | 'manifest'
  | 'tracking'
  | 'webhook'
  | 'cancel'
  | 'ndr'
  | 'wallet'
  | 'insurance'
  /** Book a courier to collect a customer return from the shopper (a reverse pickup). */
  | 'reverse_pickup'
  /** Carry parcels abroad, with the customs lines and commercial invoice that needs. */
  | 'international'

/**
 * Where a courier delivers. `domestic` (the default when a provider leaves it out): Indian
 * PIN codes only. `international`: other countries only (DHL Express and FedEx from India);
 * the storefront's PIN-code estimate never asks such a courier. `both`: either.
 */
export type ShippingCoverage = 'domestic' | 'international' | 'both'

/**
 * A reverse pickup: the courier collects the parcel from the shopper
 * (`from`) and brings it back to the merchant's warehouse (`to`).
 */
export type ReturnPickupInput = {
  /** Our return id; couriers echo it as their order reference. */
  returnId: string
  /** Human return reference printed on the courier's paperwork, e.g. "R-12-1044". */
  reference: string
  /** The original order's number, for the merchant's own lookup. */
  orderNumber: number
  from: ShipmentAddress
  to: ShipmentAddress
  lines: ShipmentLine[]
  valuePaise: number
  weightGrams: number
}

export type SchedulePickupInput = {
  pickupLocationName: string
  /** "YYYY-MM-DD". */
  date: string
  /** "HH:mm", 24h, the courier's local time. */
  timeFrom: string
  timeTo?: string | undefined
  expectedPackageCount: number
}

export type SchedulePickupResult = {
  /** The courier's own id for this pickup request, shown to the merchant for support calls. */
  providerPickupId: string
}

export type NdrAction = 'reattempt' | 'change_address' | 'rto'

export type NdrActionInput = {
  waybill: string
  action: NdrAction
  /** For `change_address`. */
  name?: string | undefined
  phone?: string | undefined
  address?: string | undefined
  /** For `reattempt` when the courier wants a specific date, "YYYY-MM-DD". */
  deferredDate?: string | undefined
  comment?: string | undefined
}

export type NdrActionResult = {
  accepted: boolean
  /** The courier's own reference for this action (Delhivery's UPL id, an async job id, ...). */
  providerRef?: string | undefined
}

export type WalletBalance = {
  balancePaise: number
  /** ISO instant this figure was fetched at. */
  asOf: string
}

/** A raw inbound tracking webhook, headers lower-cased. Provider verifies its own signature. */
export type WebhookRequest = {
  rawBody: string
  headers: Record<string, string | undefined>
}

/** One shipment a webhook call told us about. The caller re-fetches full tracking by waybill. */
export type WebhookNotice = {
  waybill: string
  /** Stable id for dedupe; falls back to a hash of the body when the courier gives none. */
  eventId: string
}

export type ShippingProvider = {
  /** Stable id used in store settings and the shipment table. Lowercase, no spaces. */
  readonly id: string
  readonly label: string
  /** Where it delivers; absent means `domestic`. See `ShippingCoverage`. */
  readonly coverage?: ShippingCoverage | undefined
  /**
   * True for a courier booked outside the platform (India Post's counter): `createShipment`
   * needs the merchant's own tracking number in `trackingNumber`, so the Create shipment flow
   * asks for it.
   */
  readonly requiresTrackingNumber?: boolean | undefined
  /**
   * True when the courier has no tracking feed for us: the merchant sets the status by hand
   * (`recordManualTracking` in core) and the shared poll job never calls `track()`.
   */
  readonly tracksManually?: boolean | undefined
  /**
   * The pickup location (warehouse) name on the courier account, used when a booking names none
   * (Delhivery's "Pickup location name" on its Connect page). A pickup request for such a parcel
   * must name the same place, or the courier never links the two.
   */
  readonly defaultPickupLocationName?: string | undefined
  /**
   * Optional: what the courier would charge for this parcel, or null when it
   * will not quote. Checkout prices shipping from the merchant's zones and
   * rates (Settings → Shipping → Shipping rates), so a courier without this
   * method (Delhivery today: it only answers serviceability) loses nothing.
   * It exists so a carrier-calculated rate type can be added without
   * changing the contract again.
   */
  quoteRate?(query: RateQuery): Promise<RateQuote | null>
  /**
   * Optional: every service the courier offers on this route, each with its price and what
   * it itemised. The Create shipment rate table lists them all when present and falls back
   * to `quoteRate` (one row) otherwise.
   */
  quoteOptions?(query: RateQuery): Promise<RateOption[]>
  /**
   * Look up serviceability. Throws CourierError on transport or auth failure;
   * returns `serviceable: false` for a successful lookup with a negative
   * answer. The distinction matters: the first is our problem and gets a
   * fallback, the second is the truth and gets shown to the customer.
   */
  checkServiceability(query: ServiceabilityQuery): Promise<Serviceability>
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>
  track(waybill: string): Promise<Tracking>
  /**
   * Cancel a booked consignment. Throw CourierError('rejected', ...) with the courier's reason
   * when it refuses (already picked up, already cancelled), so the merchant sees why.
   */
  cancel(waybill: string): Promise<void>
  /**
   * Present for a courier that serves its label only behind the API key (`labelViaProvider` at
   * booking): the label PDF for this waybill, fetched server-side.
   */
  getLabel?(waybill: string): Promise<ShippingLabelDocument>
  /** Used by the admin settings page to tell the merchant their keys work. */
  verifyCredentials(): Promise<CredentialCheck>
  /** Present only when `capabilities` includes `pickup`. */
  schedulePickup?(input: SchedulePickupInput): Promise<SchedulePickupResult>
  /** Present only when `capabilities` includes `ndr`. */
  ndrAction?(input: NdrActionInput): Promise<NdrActionResult>
  /** Present only when `capabilities` includes `wallet`. */
  getWalletBalance?(): Promise<WalletBalance>
  /**
   * Present only when `capabilities` includes `reverse_pickup`. Books the
   * courier to collect a return from the shopper; the result's waybill is
   * the return's tracking number.
   */
  createReturnPickup?(input: ReturnPickupInput): Promise<CreateShipmentResult>
  /**
   * Present only when `capabilities` includes `webhook`. Verifies whatever
   * signature the courier sends and returns the AWBs it mentioned; the
   * caller re-fetches each one's tracking with `track()` rather than trust
   * the pushed payload's shape, since couriers change it without notice.
   * Throw CourierError('auth', ...) for a signature that does not check out.
   */
  parseWebhook?(request: WebhookRequest): Promise<WebhookNotice[]>
}

/** Same shape as the payments ProviderField; copied so this package stays dependency-free. */
export type ProviderField = {
  key: string
  label: string
  /** Encrypted at rest and masked in the UI. */
  secret?: boolean
  required?: boolean
  multiline?: boolean
  /** `boolean` renders a checkbox and stores 'true' | 'false'. Defaults to text. */
  type?: 'text' | 'boolean'
  help?: string
}

export type ShippingProviderFactory<Config> = {
  id: string
  label: string
  /** What the merchant fills in Settings > Shipping (or the app's own connect page). Drives the form. */
  fields: ProviderField[]
  /** What this adapter can do; the admin uses it to grey out unsupported actions. */
  capabilities: ShippingCapability[]
  /**
   * True when `checkServiceability` answers without the merchant's credentials (DTDC's PIN code
   * lookup is a public endpoint), so a passing lookup proves nothing about the key: the Connect
   * page's "Test connection" then also runs `verifyCredentials`.
   */
  serviceabilityWithoutCredentials?: boolean
  validateConfig(raw: unknown): { ok: true; config: Config } | { ok: false; errors: string[] }
  create(config: Config): ShippingProvider
}
