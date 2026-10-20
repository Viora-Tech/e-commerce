/**
 * Every Xpressbees wire shape in one place: request bodies we build, answers we read, and the
 * status vocabulary reduced to ours. The adapter (`xpressbees.ts`) only moves data through
 * these, so when a live account disagrees with a field name the fix lands here.
 *
 * SOURCE: Xpressbees' shipping API at `https://shipment.xpressbees.com/api` (the seller
 * dashboard's API, Settings > API). Xpressbees publishes no public docs page; its PDF is handed
 * out by the account team. The shapes below follow that PDF as reproduced by several
 * independent integrations on GitHub that agree with each other (login -> `data` token,
 * `courier/serviceability`, `shipments2`, `shipments2/track/{awb}`, `shipments2/cancel`,
 * `shipments2/manifest`, `ndr/create`). VERIFY WITH A LIVE ACCOUNT: anything marked
 * "verify" below was not in more than one source.
 */

import type {
  CreateShipmentInput,
  NdrActionInput,
  RateCharge,
  ShipmentStatus,
} from '@commerce/shipping'

export const XPRESSBEES_BASE_URL = 'https://shipment.xpressbees.com/api'

export type LoginResponse = { status?: boolean; data?: unknown; message?: string }

export type ServiceRate = {
  /** Xpressbees' courier (service) id, sent back as `courier_id` when booking. */
  id?: string | number
  name?: string
  freight_charges?: number | string
  cod_charges?: number | string
  total_charges?: number | string
  chargeable_weight?: number | string
}

export type ServiceabilityResponse = { status?: boolean; data?: ServiceRate[]; message?: string }

export type ShipmentResponse = {
  status?: boolean
  message?: string
  data?: {
    order_id?: string | number
    shipment_id?: string | number
    awb_number?: string
    courier_id?: string | number
    courier_name?: string
    status?: string
    label?: string
    manifest?: string
  }
}

export type TrackResponse = {
  status?: boolean
  message?: string
  data?: {
    awb_number?: string
    status?: string
    history?: Array<{
      status_code?: string
      location?: string
      event_time?: string
      message?: string
    }>
  }
}

export type SimpleResponse = { status?: boolean; message?: string; data?: unknown }

/** Package dimensions we send when the store has none: the docs' own defaults (10cm cube). */
const DEFAULT_SIDE_CM = 10

const rupees = (paise: number) => Math.round(paise) / 100

export const rupeesToPaise = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

/** Indian mobile numbers only: Xpressbees rejects anything but ten digits. */
const phone10 = (raw: string) => raw.replace(/\D/g, '').slice(-10)

export function serviceabilityBody(query: {
  originPincode: string
  destinationPincode: string
  weightGrams: number
  orderValueRupees: number
  cod: boolean
}) {
  return {
    origin: query.originPincode,
    destination: query.destinationPincode,
    payment_type: query.cod ? 'cod' : 'prepaid',
    order_amount: String(Math.max(Math.round(query.orderValueRupees), 1)),
    weight: String(Math.max(Math.ceil(query.weightGrams), 1)),
    length: String(DEFAULT_SIDE_CM),
    breadth: String(DEFAULT_SIDE_CM),
    height: String(DEFAULT_SIDE_CM),
  }
}

/** The priced lines Xpressbees itemised for one service. */
export function xpressbeesCharges(rate: ServiceRate): RateCharge[] {
  const lines: RateCharge[] = [
    { kind: 'freight', pricePaise: rupeesToPaise(rate.freight_charges) },
    { kind: 'cod', pricePaise: rupeesToPaise(rate.cod_charges) },
  ]
  return lines.filter((l) => l.pricePaise > 0)
}

/** `POST /shipments2`. `request_auto_pickup: yes` asks Xpressbees to schedule the pickup with
 *  the booking, so there is no separate pickup call. `pickup` is the registered warehouse
 *  (`warehouse_name` must match the dashboard's name); the RTO address defaults to it. */
export function shipmentBody(input: CreateShipmentInput, warehouseName: string) {
  const cod = input.paymentMode === 'cod'
  return {
    order_number: String(input.orderNumber).slice(0, 20),
    payment_type: cod ? 'cod' : 'prepaid',
    order_amount: rupees(input.valuePaise),
    collectable_amount: cod ? rupees(input.codAmountPaise) : 0,
    shipping_charges: 0,
    discount: 0,
    cod_charges: 0,
    package_weight: Math.max(Math.ceil(input.weightGrams), 1),
    package_length: DEFAULT_SIDE_CM,
    package_breadth: DEFAULT_SIDE_CM,
    package_height: DEFAULT_SIDE_CM,
    request_auto_pickup: 'yes',
    consignee: {
      name: input.to.name.slice(0, 200),
      address: input.to.line1.slice(0, 200),
      address_2: (input.to.line2 ?? '').slice(0, 200),
      city: input.to.city.slice(0, 40),
      state: input.to.state.slice(0, 40),
      pincode: input.to.pincode,
      phone: phone10(input.to.phone),
    },
    pickup: {
      warehouse_name: (input.pickupLocationName || warehouseName).slice(0, 20),
      name: input.from.name.slice(0, 200),
      address: input.from.line1.slice(0, 200),
      address_2: (input.from.line2 ?? '').slice(0, 200),
      city: input.from.city.slice(0, 40),
      state: input.from.state.slice(0, 40),
      pincode: input.from.pincode,
      phone: phone10(input.from.phone),
    },
    order_items: input.lines.map((l) => ({
      name: l.title.slice(0, 200),
      qty: String(l.quantity),
      price: String(rupees(l.unitPricePaise)),
    })),
    ...(input.serviceId ? { courier_id: input.serviceId } : {}),
  }
}

/**
 * `POST /ndr/create` takes an array of actions. Documented actions: `re-attempt` (with
 * `re_attempt_date`), `change_address` and `change_phone`. Xpressbees has no "return it"
 * action on this API (RTO is raised from the dashboard), so `rto` is refused before any call.
 * VERIFY: the exact `action_data` keys for change_address (`address_1`/`address_2`).
 */
export function ndrBody(input: NdrActionInput): Array<Record<string, unknown>> | null {
  if (input.action === 'rto') return null
  if (input.action === 'reattempt') {
    const date = input.deferredDate ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    return [{ awb: input.waybill, action: 're-attempt', action_data: { re_attempt_date: date } }]
  }
  const actions: Array<Record<string, unknown>> = []
  if (input.address || input.name) {
    actions.push({
      awb: input.waybill,
      action: 'change_address',
      action_data: { name: input.name ?? '', address_1: input.address ?? '', address_2: '' },
    })
  }
  if (input.phone) {
    actions.push({
      awb: input.waybill,
      action: 'change_phone',
      action_data: { phone: phone10(input.phone) },
    })
  }
  return actions
}

/**
 * Xpressbees' scan codes (`history[].status_code`) and coarse shipment `status`, reduced to
 * ours. Codes: PP pending pickup, PU picked up, IT in transit, OFD/FD out for delivery, DL
 * delivered, EX/UD exception or undelivered (an attempt, so still in transit), RT/RT-IT/RT-DL
 * return to origin, CAN cancelled. Unknown codes fall back to the status text, then to
 * `in_transit` rather than guessing a terminal state.
 */
export function mapXpressbeesStatus(
  code: string | null | undefined,
  status?: string | null,
): ShipmentStatus {
  const c = (code ?? '').toUpperCase().trim()
  if (c === 'DL') return 'delivered'
  if (c.startsWith('RT')) return 'rto'
  if (c === 'CAN' || c.startsWith('CANCEL')) return 'cancelled'
  if (c === 'OFD' || c === 'FD') return 'out_for_delivery'
  if (c === 'PU') return 'picked_up'
  if (c === 'PP' || c === 'MAN' || c === 'OFP') return 'created'
  if (['IT', 'EX', 'UD', 'NDR', 'LT', 'DG'].includes(c)) return 'in_transit'

  const s = (status ?? '').toLowerCase().replace(/[\s-]+/g, '_')
  if (s.startsWith('rto') || s.includes('return')) return 'rto'
  if (s.includes('undelivered') || s === 'ndr' || s.includes('exception')) return 'in_transit'
  if (s.includes('out_for_delivery')) return 'out_for_delivery'
  if (s.includes('delivered')) return 'delivered'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('picked')) return 'picked_up'
  if (['booked', 'pending_pickup', 'manifested', 'created', 'new'].includes(s)) return 'created'
  return 'in_transit'
}

/**
 * The scan's own wording, with "Undelivered: " in front when the courier's code marks a failed
 * delivery attempt. The platform raises an NDR from the latest scan's wording
 * (`NDR_PHRASES` in packages/core/src/shipping/ndr.ts), and this courier's attempt remarks
 * ("Consignee shifted") do not always say so in words.
 */
export function scanDescription(code: string | undefined, message: string | undefined): string {
  const text = message || code || ''
  const attempt = ['UD', 'EX', 'NDR'].includes((code ?? '').toUpperCase().trim())
  return attempt && !/undeliver|ndr/i.test(text) ? `Undelivered: ${text}` : text
}

/** Xpressbees sends scan times as "YYYY-MM-DD HH:mm" India time, with no zone. */
export function xpressbeesTime(raw: string | undefined): string {
  if (!raw) return new Date(0).toISOString()
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw) ? `${raw.replace(' ', 'T')}+05:30` : raw
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? new Date(0).toISOString() : at.toISOString()
}

/** Header names the webhook signature has been seen under; Xpressbees sends `x-hmac-sha256`
 *  (base64 HMAC-SHA256 of the raw body). VERIFY the header on a live account. */
export const XPRESSBEES_SIGNATURE_HEADERS = ['x-hmac-sha256', 'x-xpressbees-signature'] as const
