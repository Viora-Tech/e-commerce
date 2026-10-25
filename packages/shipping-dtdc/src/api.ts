/**
 * DTDC's wire format, kept in one file so a correction from a live account touches nothing
 * else. Everything the adapter sends or reads about DTDC's JSON lives here.
 *
 * DTDC hands its API kit (Shipsy "softdata" booking, the label stream, cancel, and the
 * separate tracking service) to account holders only; none of it is published. The shapes
 * below are the ones in that kit as other integrations use them.
 *
 * VERIFY WITH A LIVE ACCOUNT - all of this is the best documented shape, not a confirmed one:
 *
 *   [verify] booking: POST {base}/api/customer/integration/consignment/softdata, header
 *            `api-key`, body `{ consignments: [...] }`, answer `{ status, data: [{ success,
 *            reference_number, message }] }`. COD as `cod_collection_mode: "cash"` + `cod_amount`.
 *   [verify] label: GET .../consignment/shippinglabel/stream?reference_number=&label_code=
 *            SHIP_LABEL_4X6&label_format=pdf, answering the PDF itself.
 *   [verify] cancel: POST .../consignment/cancel `{ AWBNo: [...], customerCode }`.
 *   [verify] tracking: a different host and login - GET blktracksvc.dtdc.com/dtdc-api/api/
 *            dtdc/authenticate?username=&password= answers a token, then POST .../rest/
 *            JSONCnTrk/getTrackDetails with `X-Access-Token`, answering `trackHeader` +
 *            `trackDetails[]` with `ddMMyyyy` dates and `HHmm` times.
 *   [verify] PIN codes: POST smarttrack.ctbsplus.dtdc.com/ratecalapi/PincodeApiCall
 *            `{ orgPincode, desPincode }`, answering `ZIPCODE_RESP[].SERVFLAG`. Public, no key.
 *   [verify] service type ids ("B2C PRIORITY", "B2C SMART EXPRESS", "GROUND EXPRESS") per contract.
 */

import type { CreateShipmentInput, ShipmentStatus } from '@commerce/shipping'

export const DTDC_PATHS = {
  softdata: '/api/customer/integration/consignment/softdata',
  label: '/api/customer/integration/consignment/shippinglabel/stream',
  cancel: '/api/customer/integration/consignment/cancel',
} as const

export const DTDC_TRACKING_BASE_URL = 'https://blktracksvc.dtdc.com/dtdc-api'
export const DTDC_TRACKING_PATHS = {
  authenticate: '/api/dtdc/authenticate',
  track: '/rest/JSONCnTrk/getTrackDetails',
} as const

export const DTDC_PINCODE_URL = 'https://smarttrack.ctbsplus.dtdc.com/ratecalapi/PincodeApiCall'

export const DTDC_DEFAULT_SERVICE = 'B2C PRIORITY'

export type SoftdataResponse = {
  status?: string
  message?: string
  error?: { message?: string } | string
  data?: Array<{
    success?: boolean
    reference_number?: string
    customer_reference_number?: string
    message?: string
    reason?: string
  }>
}

export type CancelResponse = {
  status?: string
  success?: boolean
  message?: string
  failures?: Array<{ reference_number?: string; reason?: string; message?: string }>
}

export type TrackDetail = {
  strCode?: string
  strAction?: string
  strOrigin?: string
  strDestination?: string
  strActionDate?: string
  strActionTime?: string
  sTrRemarks?: string
}

export type TrackResponse = {
  statusCode?: number
  statusFlag?: boolean
  status?: string
  errorDetails?: Array<{ name?: string; value?: string }> | null
  trackHeader?: {
    strShipmentNo?: string
    strStatus?: string
    strStatusTransOn?: string
    strStatusTransTime?: string
    strExpectedDeliveryDate?: string
  }
  trackDetails?: TrackDetail[]
}

export type PincodeResponse = {
  ZIPCODE_RESP?: Array<{ PIN?: string; SERVFLAG?: string; MESSAGE?: string }>
  SERV_LIST?: Array<Record<string, unknown>>
  SERV_LIST_DTLS?: Array<Record<string, unknown>>
}

const isYes = (v: unknown) => typeof v === 'string' && /^(y|yes)$/i.test(v.trim())

/** Whether DTDC serves the destination, and whether any of its services there takes COD. */
export function readPincode(
  body: PincodeResponse,
  destination: string,
): { serviceable: boolean; cod: boolean } {
  const zips = body.ZIPCODE_RESP ?? []
  const entry = zips.find((z) => z.PIN === destination) ?? (zips.length === 1 ? zips[0] : undefined)
  const serviceable = isYes(entry?.SERVFLAG)
  const services = [...(body.SERV_LIST ?? []), ...(body.SERV_LIST_DTLS ?? [])]
  const cod = services.some((s) =>
    Object.entries(s).some(([key, value]) => /cod/i.test(key) && isYes(value)),
  )
  return { serviceable, cod }
}

/** `ddMMyyyy` + `HHmm`, India time, to an ISO instant. Null when unreadable. */
export function parseDtdcDate(date: string | undefined, time?: string): string | null {
  const d = /^(\d{2})(\d{2})(\d{4})$/.exec(date?.trim() ?? '')
  if (!d) return null
  const t = /^(\d{2}):?(\d{2})/.exec(time?.trim() ?? '') ?? ['', '00', '00']
  // IST is UTC+5:30 all year.
  const utc = Date.UTC(
    Number(d[3]),
    Number(d[2]) - 1,
    Number(d[1]),
    Number(t[1]) - 5,
    Number(t[2]) - 30,
  )
  return Number.isNaN(utc) ? null : new Date(utc).toISOString()
}

/**
 * DTDC's scan wording, reduced to ours. The tracking service names each step in plain text
 * ("Softdata Upload", "Booked", "In Transit", "Out For Delivery", "Not Delivered", "Delivered",
 * "RTO ..."); the short codes (BKD, DLV, NONDLV, RTO) back it up. [verify] the code list.
 */
export function mapDtdcStatus(code: string | undefined, text: string | undefined): ShipmentStatus {
  const c = (code ?? '').toUpperCase()
  const t = (text ?? '').toLowerCase()
  if (c.startsWith('RTO') || /\brto\b|return(ed)? to (origin|shipper)/.test(t)) return 'rto'
  if (/not delivered|undelivered|non delivery/.test(t) || c === 'NONDLV') return 'in_transit'
  if (c === 'DLV' || /\bdelivered\b/.test(t)) return 'delivered'
  if (/cancel/.test(t)) return 'cancelled'
  if (/out for delivery/.test(t) || c === 'OUTDLV') return 'out_for_delivery'
  if (/softdata|pickup (scheduled|awaited|pending)|manifest/.test(t)) return 'created'
  if (c === 'BKD' || /\bbooked\b|picked up|pickup (done|completed)/.test(t)) return 'picked_up'
  return 'in_transit'
}

const rupees = (paise: number) => (Math.round(paise) / 100).toFixed(2)
const digits = (phone: string) => phone.replace(/\D/g, '').slice(-10)

const party = (a: CreateShipmentInput['to']) => ({
  name: a.name,
  phone: digits(a.phone),
  alternate_phone: '',
  address_line_1: a.line1,
  address_line_2: a.line2 ?? '',
  pincode: a.pincode,
  city: a.city,
  state: a.state,
})

/** The `consignments[0]` DTDC's softdata booking wants, from our neutral input. */
export function softdataConsignment(
  input: CreateShipmentInput,
  o: { customerCode: string; serviceType: string },
) {
  const cod = input.paymentMode === 'cod'
  return {
    customer_code: o.customerCode,
    service_type_id: input.serviceId || o.serviceType,
    load_type: 'NON-DOCUMENT',
    description: input.lines
      .map((l) => `${l.title} x${l.quantity}`)
      .join(', ')
      .slice(0, 100),
    dimension_unit: 'cm',
    length: '10',
    width: '10',
    height: '10',
    weight_unit: 'kg',
    weight: (Math.max(50, Math.round(input.weightGrams)) / 1000).toFixed(3),
    declared_value: rupees(input.valuePaise),
    num_pieces: '1',
    origin_details: party(input.from),
    destination_details: party(input.to),
    return_details: party(input.from),
    customer_reference_number: String(input.orderNumber),
    cod_collection_mode: cod ? 'cash' : '',
    cod_amount: cod ? rupees(input.codAmountPaise) : '',
    commodity_id: '99',
    is_risk_surcharge_applicable: false,
    reference_number: '',
  }
}

/** The first readable reason in a booking answer that did not succeed. */
export function softdataError(body: SoftdataResponse): string | null {
  const row = body.data?.[0]
  if (row?.success === true && row.reference_number) return null
  const nested = typeof body.error === 'string' ? body.error : body.error?.message
  return row?.message || row?.reason || nested || body.message || 'no detail returned'
}
