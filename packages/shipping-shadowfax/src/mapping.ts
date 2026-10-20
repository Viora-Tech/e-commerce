/**
 * Every Shadowfax wire shape in one place: request bodies we build, answers we read, and the
 * status vocabulary reduced to ours. The adapter (`shadowfax.ts`) only moves data through these.
 *
 * SOURCE: Shadowfax's Apiary docs, "Shadowfax Unified API for Forward Integrations"
 * (marketplace / seller-pickup model) and "Shadowfax Reverse Pickup API"
 * (sfxreversepickup.docs.apiary.io). Base `https://dale.shadowfax.in/api` (staging
 * `dale.staging.shadowfax.in`), header `Authorization: Token <key>`.
 *
 * CONFIRMED in the docs: serviceability list, reverse create (`/v3/clients/requests`), reverse
 * cancel (`/v2/clients/requests/mark_cancel`), reverse tracking (`/v4/clients/requests/{awb}`),
 * label (`/client/generate_label/`), forward cancel (`/v3/clients/orders/cancel/`, 304 means
 * queued), the push callback payload and the status table.
 *
 * VERIFY WITH A LIVE ACCOUNT: the forward create body (`/v3/clients/orders/`; the public page
 * names its sections, order_details / customer_details / pickup_details / rts_details /
 * product_details, but the field list is behind the Apiary console), the forward tracking
 * answer (`/v4/clients/orders/{awb}/track/`), and the NDR body on `order_update`. The shapes
 * below match what working integrations send.
 */

import type {
  CreateShipmentInput,
  NdrActionInput,
  ReturnPickupInput,
  ShipmentAddress,
  ShipmentStatus,
} from '@commerce/shipping'

export const SHADOWFAX_BASE_URL = 'https://dale.shadowfax.in/api'

export type ServiceabilityRow = { code?: number | string; services?: string[] }

export type ForwardCreateResponse = {
  message?: string
  errors?: unknown
  data?: { awb_number?: string; client_order_id?: string; status?: string }
}

export type ReverseCreateResponse = {
  message?: string
  errors?: unknown
  client_request_id?: string
  client_order_number?: string
  status?: string
}

export type CancelResponse = { responseMsg?: string; responseCode?: number; message?: string }

export type LabelResponse = { message?: string; data?: { label_url?: string } }

/** `GET /v4/clients/orders/{awb}/track/`: history beside the order, not inside it. */
export type ForwardTrackResponse = {
  order_details?: {
    awb_number?: string
    status?: string
    status_id?: string
    customer_track_url?: string
    promised_delivery_date?: string
  }
  tracking_details?: Array<{
    created?: string
    location?: string
    status_id?: string
    status?: string
    remarks?: string
  }>
}

/** `GET /v4/clients/requests/{awb}` (reverse). */
export type ReverseTrackResponse = {
  client_request_id?: string
  status?: string
  pickup_request_state_histories?: Array<{
    created_at?: string
    current_location?: string
    state?: string
    comment?: string
  }> | null
}

export type UpdateResponse = { message?: string; errors?: unknown; responseCode?: number }

const rupees = (paise: number) => Math.round(paise) / 100

const phone10 = (raw: string) => raw.replace(/\D/g, '').slice(-10)

/** `errors` is a string on some refusals and a field-keyed object on others. */
export function describeErrors(errors: unknown, fallback?: string): string {
  if (typeof errors === 'string' && errors.trim()) return errors.trim()
  if (errors && typeof errors === 'object') {
    const flat = JSON.stringify(errors)
    if (flat && flat !== '{}') return flat.slice(0, 300)
  }
  return fallback?.trim() || 'no detail returned'
}

function party(a: ShipmentAddress) {
  return {
    name: a.name,
    contact: phone10(a.phone),
    address_line_1: a.line1,
    address_line_2: a.line2 ?? '',
    city: a.city,
    state: a.state,
    pincode: Number(a.pincode),
  }
}

/** `POST /v3/clients/orders/`, marketplace model: Shadowfax collects from the seller's
 *  address (`pickup_details`) and returns undelivered parcels to it (`rts_details`). */
export function forwardBody(input: CreateShipmentInput) {
  const cod = input.paymentMode === 'cod'
  return {
    order_type: 'marketplace',
    order_details: {
      client_order_id: `${input.orderNumber}-${input.orderId.slice(0, 8)}`,
      actual_weight: Math.max(Math.ceil(input.weightGrams), 1),
      volumetric_weight: 0,
      product_value: rupees(input.valuePaise),
      payment_mode: cod ? 'COD' : 'Prepaid',
      cod_amount: cod ? rupees(input.codAmountPaise) : 0,
      total_amount: rupees(input.valuePaise),
    },
    customer_details: party(input.to),
    pickup_details: party(input.from),
    rts_details: party(input.from),
    product_details: input.lines.map((l) => ({
      sku_name: l.title.slice(0, 200),
      price: rupees(l.unitPricePaise),
      additional_details: { quantity: l.quantity },
    })),
  }
}

/** `POST /v3/clients/requests` (reverse pickup to the merchant's warehouse). The SKU's GST
 *  block is listed as required; a seller without GST sends it blank, which staging accepts. */
export function reverseBody(input: ReturnPickupInput, sellerGstin: string) {
  return {
    client_order_number: input.reference,
    warehouse_name: input.to.name,
    warehouse_address: [input.to.line1, input.to.line2, input.to.city].filter(Boolean).join(', '),
    destination_pincode: Number(input.to.pincode),
    total_amount: rupees(input.valuePaise),
    price: rupees(input.valuePaise),
    pickup_type: 'regular',
    address_attributes: {
      address_line: [input.from.line1, input.from.line2].filter(Boolean).join(', '),
      city: input.from.city,
      country: 'India',
      pincode: Number(input.from.pincode),
      name: input.from.name,
      phone_number: phone10(input.from.phone),
    },
    weight_details: {
      actual_weight: Math.max(Math.ceil(input.weightGrams), 1),
      volumetric_weight: 0,
    },
    skus_attributes: input.lines.map((l) => ({
      name: l.title.slice(0, 200),
      price: rupees(l.unitPricePaise),
      return_reason: 'Customer return',
      qc_required: 'false',
      seller_details: {
        regd_name: input.to.name,
        regd_address: input.to.line1,
        state: input.to.state,
        gstin: sellerGstin,
      },
      taxes: { cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total_tax_amount: 0 },
      hsn_code: '',
      invoice_id: input.reference,
      additional_details: { quantity: l.quantity },
    })),
  }
}

/**
 * NDR through `POST /v3/clients/order_update/`: the docs allow setting the status to
 * `reopen_ndr` (deliver again) or `rto` while the order is on hold, and editing the delivery
 * details before out-for-delivery. VERIFY the body keys on a live account.
 */
export function ndrBody(input: NdrActionInput) {
  const details =
    input.address || input.phone || input.name
      ? {
          delivery_details: {
            ...(input.name ? { name: input.name } : {}),
            ...(input.phone ? { contact: phone10(input.phone) } : {}),
            ...(input.address ? { address_line_1: input.address } : {}),
          },
        }
      : {}
  return {
    awb_number: input.waybill,
    status: input.action === 'rto' ? 'rto' : 'reopen_ndr',
    ...(input.action === 'rto' ? {} : details),
    ...(input.comment ? { remarks: input.comment } : {}),
  }
}

/**
 * Shadowfax's `status_id` values (docs "Order States", forward, reverse and push), and the
 * display names the reverse history uses, reduced to ours. Attempts (nc, na, cid, on_hold,
 * reopen_ndr) stay in transit. Unknown values fall back to `in_transit`.
 */
export function mapShadowfaxStatus(raw: string | null | undefined): ShipmentStatus {
  const s = (raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
  if (s === 'delivered') return 'delivered'
  if (s.startsWith('rts') || s.startsWith('rto') || s === 'returned_to_client') return 'rto'
  if (s.startsWith('cancelled')) return 'cancelled'
  if (s === 'ofd' || s === 'out_for_delivery') return 'out_for_delivery'
  if (['picked', 'received_from_client_warehouse', 'recd_at_rev_hub'].includes(s))
    return 'picked_up'
  if (
    [
      'new',
      'assigned',
      'assigned_for_pickup',
      'assigned_for_seller_pickup',
      'ofp',
      'out_for_pickup',
      'pickup_not_attempted',
      'pickup_on_hold',
      'seller_initiated_delay',
      'seller_not_contactable',
    ].includes(s)
  ) {
    return 'created'
  }
  return 'in_transit'
}

/**
 * The scan's own wording, with "Undelivered: " in front when the courier's code marks a failed
 * delivery attempt. The platform raises an NDR from the latest scan's wording
 * (`NDR_PHRASES` in packages/core/src/shipping/ndr.ts), and this courier's attempt remarks
 * ("Customer not contactable") do not always say so in words.
 */
export function scanDescription(statusId: string | undefined, remarks: string | undefined): string {
  const text = remarks || statusId || ''
  const id = (statusId ?? '').toLowerCase().replace(/[\s-]+/g, '_')
  const attempt = ['nc', 'na', 'cid', 'on_hold', 'not_contactable', 'not_attempted'].includes(id)
  return attempt && !/undeliver|ndr/i.test(text) ? `Undelivered: ${text}` : text
}

/** Shadowfax stamps are "YYYY-MM-DD HH:MM:SS" (docs say UTC on API answers, but the push
 *  callback sends India time). Read with a zone when one is present, else as India time. */
export function shadowfaxTime(raw: string | undefined, assumeIst = true): string {
  if (!raw) return new Date(0).toISOString()
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
  const iso = hasZone ? raw : `${raw.replace(' ', 'T')}${assumeIst ? '+05:30' : 'Z'}`
  const at = new Date(iso)
  return Number.isNaN(at.getTime()) ? new Date(0).toISOString() : at.toISOString()
}

/** Reverse AWBs start with "R" (docs samples: R10000021ZI, R18481863TMA); forward with "SF". */
export const isReverseAwb = (awb: string) => /^R\d/.test(awb)
