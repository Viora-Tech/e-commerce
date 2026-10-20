/**
 * Every Ekart wire shape in one place: request bodies we build, answers we read, and the
 * status vocabulary reduced to ours. The adapter (`ekart.ts`) only moves data through these.
 *
 * SOURCE: Ekart's own OpenAPI document "Ekart API Docs" v3.8.9 for the Elite platform
 * (`https://app.elite.ekartlogistics.in`, docs at `/api/docs`). Ekart is retiring the older
 * `api.ekartlogistics.com` v2 host, so only Elite is supported. Every path and field below is
 * from that document; the two things it leaves out are marked VERIFY WITH A LIVE ACCOUNT:
 *  - the webhook signature header name (the docs say the secret HMACs the body, not where the
 *    signature travels), and
 *  - whether a single registered pickup address really autofills when `pickup_location` is
 *    left out (the docs say so; the schema still lists it as required).
 */

import type {
  CreateShipmentInput,
  NdrActionInput,
  ReturnPickupInput,
  ShipmentAddress,
  ShipmentStatus,
} from '@commerce/shipping'

export const EKART_BASE_URL = 'https://app.elite.ekartlogistics.in'

export type TokenResponse = { access_token?: string; expires_in?: number; token_type?: string }

/** `GET /api/v2/serviceability/{pincode}`. */
export type PincodeResponse = {
  status?: boolean
  remark?: string
  details?: {
    cod?: boolean
    max_cod_amount?: number
    forward_pickup?: boolean
    forward_drop?: boolean
    reverse_pickup?: boolean
    reverse_drop?: boolean
  }
}

/** One row of `POST /data/v3/serviceability`: a courier group with its TAT and estimate. */
export type RouteOption = {
  tat?: { min?: number; max?: number }
  courierGroup?: string
  forwardDeliveredCharges?: {
    forwardFreight?: string
    forwardFuelSurcharge?: string
    codCharges?: string
    deliveredTotalTax?: string
    totalForwardDeliveredEstimate?: string
  }
}

export type Acknowledgement = { status?: boolean; remark?: string; tracking_id?: string }

export type CreateResponse = Acknowledgement & { vendor?: string; barcodes?: { wbn?: string } }

export type CancelResponse = { data?: Acknowledgement[] }

export type ManifestResponse = { manifestNumber?: number; manifestDownloadUrl?: string }

/** `GET /api/v1/track/{id}` (an open API: no token). */
export type TrackResponse = {
  _id?: string
  edd?: number
  track?: {
    status?: string
    ctime?: number
    desc?: string
    location?: string
    ndrStatus?: string
    details?: Array<{
      status?: string
      ctime?: number
      desc?: string
      location?: string
      ndrStatus?: string
    }>
  }
}

/** Fixed parcel size when the store keeps none: Ekart requires length, width and height. */
const DEFAULT_SIDE_CM = 10

const rupees = (paise: number) => Math.round(paise) / 100

export const rupeesToPaise = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

const phone10 = (raw: string) => Number(raw.replace(/\D/g, '').slice(-10))

export function location(a: ShipmentAddress, name?: string) {
  return {
    name: name ?? a.name,
    phone: phone10(a.phone),
    pin: Number(a.pincode),
    address: [a.line1, a.line2].filter(Boolean).join(', '),
    city: a.city,
    state: a.state,
    country: 'India',
  }
}

export type SellerDetails = {
  sellerName: string
  sellerAddress: string
  /** Blank for a seller without GST registration. */
  sellerGstin: string
  /** Registered pickup address alias on Ekart; blank means the account's only address. */
  pickupAlias: string
}

/** The registered pickup and RTO address by alias (docs: "send us the alias"), or nothing at
 *  all when the account has one registered address, which Ekart then fills in itself. */
function sellerLocations(alias: string) {
  return alias ? { pickup_location: { name: alias }, return_location: { name: alias } } : {}
}

function common(
  lines: CreateShipmentInput['lines'],
  valuePaise: number,
  weightGrams: number,
  seller: SellerDetails,
) {
  const total = Math.max(rupees(valuePaise), 1)
  const today = new Date().toISOString().slice(0, 10)
  return {
    seller_name: seller.sellerName,
    seller_address: seller.sellerAddress,
    seller_gst_tin: seller.sellerGstin,
    consignee_gst_amount: 0,
    invoice_date: today,
    products_desc:
      lines
        .map((l) => l.title)
        .join(', ')
        .slice(0, 250) || 'Goods',
    category_of_goods: 'General',
    // Prices here are tax-inclusive; the split is the invoice's job, not the courier's.
    total_amount: total,
    tax_value: 0,
    taxable_amount: total,
    commodity_value: String(total),
    quantity: Math.max(
      lines.reduce((n, l) => n + l.quantity, 0),
      1,
    ),
    weight: Math.max(Math.ceil(weightGrams), 1),
    length: DEFAULT_SIDE_CM,
    width: DEFAULT_SIDE_CM,
    height: DEFAULT_SIDE_CM,
  }
}

/** `PUT /api/v1/package/create`, forward: `drop_location` is the shopper. */
export function forwardBody(input: CreateShipmentInput, seller: SellerDetails) {
  const cod = input.paymentMode === 'cod'
  return {
    ...common(input.lines, input.valuePaise, input.weightGrams, seller),
    order_number: String(input.orderNumber),
    invoice_number: String(input.orderNumber),
    consignee_name: input.to.name,
    consignee_alternate_phone: String(phone10(input.to.phone)),
    payment_mode: cod ? 'COD' : 'Prepaid',
    cod_amount: cod ? rupees(input.codAmountPaise) : 0,
    return_reason: '',
    drop_location: location(input.to),
    ...sellerLocations(input.pickupLocationName || seller.pickupAlias),
  }
}

/**
 * The same call for a return: `payment_mode: Pickup`. Ekart's docs are explicit that the
 * fields keep their forward meaning even though the parcel moves the other way:
 * `drop_location` is still the shopper (where the rider collects) and `pickup_location` the
 * seller (where it ends up).
 */
export function reverseBody(input: ReturnPickupInput, seller: SellerDetails) {
  return {
    ...common(input.lines, input.valuePaise, input.weightGrams, seller),
    order_number: input.reference,
    invoice_number: input.reference,
    consignee_name: input.from.name,
    consignee_alternate_phone: String(phone10(input.from.phone)),
    payment_mode: 'Pickup',
    cod_amount: 0,
    return_reason: 'Customer return',
    drop_location: location(input.from),
    ...sellerLocations(seller.pickupAlias),
  }
}

/** `POST /api/v2/package/ndr`. v2 knows Re-Attempt and RTO; a new address or phone rides on
 *  a Re-Attempt. The date is epoch ms and must be within seven days, excluding today. */
export function ndrBody(input: NdrActionInput) {
  if (input.action === 'rto') return { action: 'RTO', wbn: input.waybill }
  const date = input.deferredDate
    ? new Date(`${input.deferredDate}T10:00:00+05:30`).getTime()
    : Date.now() + 86_400_000
  return {
    action: 'Re-Attempt',
    wbn: input.waybill,
    date,
    ...(input.phone ? { phone: input.phone.replace(/\D/g, '').slice(-10) } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(input.comment ? { instructions: input.comment } : {}),
  }
}

/** Ekart's `swift_status` values (docs enum), reduced to ours. */
export function mapEkartStatus(status: string | null | undefined): ShipmentStatus {
  const s = (status ?? '').toLowerCase().trim()
  if (s.startsWith('rto') || s === 'seller rto requested') return 'rto'
  if (s === 'delivered') return 'delivered'
  if (s === 'cancelled' || s === 'seller cancelled' || s === 'pickup cancelled') return 'cancelled'
  if (s === 'out for delivery') return 'out_for_delivery'
  if (s === 'picked up') return 'picked_up'
  if (
    [
      'order placed',
      'pickup pending',
      'pickup scheduled',
      'out for pickup',
      'not picked',
      'not serviceable',
    ].includes(s)
  ) {
    return 'created'
  }
  // In Transit, Undelivered (an attempt), Shipment Delayed, Lost, Damaged and anything new.
  return 'in_transit'
}

/**
 * The scan's own wording, with "Undelivered: " in front when the courier's code marks a failed
 * delivery attempt. The platform raises an NDR from the latest scan's wording
 * (`NDR_PHRASES` in packages/core/src/shipping/ndr.ts), and this courier's attempt remarks
 * ("Customer Unavailable") do not always say so in words.
 */
export function scanDescription(scan: {
  status?: string | undefined
  desc?: string | undefined
  ndrStatus?: string | undefined
}): string {
  const text = scan.desc || scan.status || ''
  const attempt = Boolean(scan.ndrStatus) || (scan.status ?? '').toLowerCase() === 'undelivered'
  if (!attempt || /undeliver|ndr/i.test(text)) return text
  return `Undelivered: ${[scan.ndrStatus, text].filter(Boolean).join(', ')}`
}

export const trackingUrl = (id: string) => `${EKART_BASE_URL}/track/${encodeURIComponent(id)}`

/** Where the webhook signature may arrive. VERIFY the real header on a live account. */
export const EKART_SIGNATURE_HEADERS = [
  'x-ekart-signature',
  'x-ekart-webhook-signature',
  'x-hmac-sha256',
  'x-signature',
] as const
