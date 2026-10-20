/**
 * Blue Dart's wire format, kept in one file so a correction from a live account touches
 * nothing else. Everything the adapter sends or reads about Blue Dart's JSON lives here.
 *
 * SOURCES: the Blue Dart API Gateway reference on developer.dhl.com ("Blue Dart-Waybill",
 * "BD Registration Pickup", "Blue Dart-Tracking Of Shipment", "BD-Location Finder",
 * "BD-Transit Time"). Those pages publish the endpoint paths, the `JWTToken` header and every
 * REQUEST field name used below, but no response examples, and the token (Authenticator) page
 * sits behind the portal login.
 *
 * VERIFY WITH A LIVE ACCOUNT - everything marked [verify] is the best documented shape, not a
 * confirmed one:
 *
 *   [verify] token: GET /in/transportation/token/v1/login with `ClientID` + `clientSecret`
 *            headers, answer `{ JWTToken }` (the shape other integrations use).
 *   [verify] response field names: `GenerateWayBillResult`, `AWBNo`, `AWBPrintContent`,
 *            `IsError`, `Status[].StatusInformation`, `GetServicesforPincodeResult`,
 *            `RegisterPickupResult.TokenNumber`, the tracking JSON's `ShipmentData.Shipment[]`.
 *   [verify] `SubProductCode` 'P' prepaid / 'C' COD and `CollectableAmount` for the COD amount.
 *   [verify] transit time path (`/transit/v1/...`; the reference page shows `time-finder/v1`)
 *            and its origin field (`ppinCode` on the reference page).
 *   [verify] tracking `StatusType` codes (DL, RT, UD, PU, IT) and date formats.
 */

import type { CreateShipmentInput, ShipmentStatus } from '@commerce/shipping'

export const BLUEDART_PATHS = {
  token: '/in/transportation/token/v1/login',
  generateWaybill: '/in/transportation/waybill/v1/GenerateWayBill',
  cancelWaybill: '/in/transportation/waybill/v1/CancelWaybill',
  registerPickup: '/in/transportation/pickup/v1/RegisterPickup',
  pincode: '/in/transportation/finder/v1/GetServicesforPincode',
  transit: '/in/transportation/transit/v1/GetDomesticTransitTimeForPinCodeandProduct',
  tracking: '/in/transportation/tracking/v1',
} as const

/** The `Profile` / `profile` block every call carries. Api_type 'S' is the documented default. */
export type BluedartProfile = { LoginID: string; LicenceKey: string; Api_type: 'S' }

/** Blue Dart's common error envelope. On HTTP 400 it sometimes arrives as `error-response: [..]`. */
export type BluedartStatus = { StatusCode?: string; StatusInformation?: string }
type ErrorFields = {
  IsError?: boolean | string
  Status?: BluedartStatus[]
  ErrorMessage?: string
  'error-response'?: Array<{ IsError?: boolean; Status?: BluedartStatus[] }>
}

/** The first readable reason in an answer, or null when it says nothing went wrong. */
export function bluedartError(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const b = body as ErrorFields & Record<string, unknown>
  const nested = b['error-response']?.[0]
  if (nested) return bluedartError(nested) ?? 'Blue Dart rejected the request.'
  const isError = b.IsError === true || b.IsError === 'true'
  const info = b.Status?.map((s) => s.StatusInformation?.trim()).find(Boolean)
  if (isError) return info || b.ErrorMessage || 'Blue Dart rejected the request.'
  return null
}

/** `{ X: {...} }` or the inner object itself: the gateway is not consistent about wrapping. */
export function unwrap<T>(body: unknown, key: string): T | undefined {
  if (!body || typeof body !== 'object') return undefined
  const b = body as Record<string, unknown>
  return (b[key] ?? b) as T
}

export type WaybillResult = ErrorFields & {
  AWBNo?: string
  /** The label PDF: base64 text, or a JSON byte array (WCF serialises byte[] either way). */
  AWBPrintContent?: string | number[] | null
  TokenNumber?: string
  DestinationArea?: string
  DestinationLocation?: string
}

export type PincodeResult = ErrorFields & {
  AreaCode?: string
  ServiceCenterCode?: string
  PincodeDescription?: string
  ApexInbound?: string
  eTailCODAirInbound?: string
  eTailPrePaidAirInbound?: string
  eTailCODGroundInbound?: string
  eTailPrePaidGroundInbound?: string
  GroundInbound?: string
}

export type TransitResult = ErrorFields & {
  ExpectedDateDelivery?: string
  ExpectedDatePOD?: string
}

export type PickupResult = ErrorFields & { TokenNumber?: string | number }

export type TrackScan = {
  ScanDetail?: {
    Scan?: string
    ScanCode?: string
    ScanType?: string
    ScanGroupType?: string
    ScanDate?: string
    ScanTime?: string
    ScannedLocation?: string
  }
}

export type TrackShipment = {
  WaybillNo?: string
  Status?: string
  StatusType?: string
  StatusDate?: string
  StatusTime?: string
  ExpectedDeliveryDate?: string
  Scans?: TrackScan[] | { ScanDetail?: TrackScan['ScanDetail'][] }
}

export type TrackResponse = {
  ShipmentData?: { Shipment?: TrackShipment[] | TrackShipment; Error?: string }
}

/** "Yes" / "Y" / true, the gateway's three spellings of yes. */
export const isYes = (v: unknown) =>
  v === true || (typeof v === 'string' && /^(y|yes|true)$/i.test(v.trim()))

/** .NET's `/Date(<ms>)/`, which every Blue Dart date field in a request uses. */
export const bluedartDate = (d: Date) => `/Date(${d.getTime()})/`

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

/**
 * A Blue Dart date (`/Date(ms)/`, `20-Sep-2026`, `20 Sep 2026` or ISO) plus an optional
 * `HHmm` / `HH:mm` time, read as India time, to an ISO instant. Null when unreadable.
 */
export function parseBluedartDate(date: string | undefined, time?: string): string | null {
  if (!date) return null
  const ms = /\/Date\((-?\d+)/.exec(date)?.[1]
  if (ms) return new Date(Number(ms)).toISOString()
  const hm = /^(\d{1,2}):?(\d{2})/.exec(time ?? '') ?? ['', '0', '0']
  const named = /^(\d{1,2})[-\s]([A-Za-z]{3})[A-Za-z]*[-\s](\d{4})/.exec(date.trim())
  if (named) {
    const month = MONTHS[named[2]?.toLowerCase() ?? '']
    if (month === undefined) return null
    // IST is UTC+5:30 all year.
    const utc = Date.UTC(
      Number(named[3]),
      month,
      Number(named[1]),
      Number(hm[1]) - 5,
      Number(hm[2]) - 30,
    )
    return new Date(utc).toISOString()
  }
  const iso = Date.parse(date)
  return Number.isNaN(iso) ? null : new Date(iso).toISOString()
}

/** The India calendar day ("YYYY-MM-DD") of an ISO instant. */
export const indiaDay = (iso: string) =>
  new Date(Date.parse(iso) + 330 * 60_000).toISOString().slice(0, 10)

/** The label bytes from `AWBPrintContent`, or null when Blue Dart sent none. */
export function decodePrintContent(content: WaybillResult['AWBPrintContent']): Uint8Array | null {
  if (!content) return null
  if (Array.isArray(content)) return content.length ? Uint8Array.from(content) : null
  const bytes = Uint8Array.from(Buffer.from(content, 'base64'))
  return bytes.length ? bytes : null
}

/**
 * Blue Dart's scan vocabulary, reduced to ours. `StatusType` leads: DL delivered, RT returned
 * to origin, UD undelivered (a failed attempt, still in flight), PU picked up, IT in transit.
 * The free-text status refines it. [verify] the code list against a live account.
 */
export function mapBluedartStatus(
  statusType: string | undefined,
  status: string | undefined,
): ShipmentStatus {
  const type = (statusType ?? '').toUpperCase()
  const text = (status ?? '').toLowerCase()
  if (type === 'RT' || /\brto\b|return(ed)? to (origin|shipper)|returned/.test(text)) return 'rto'
  if (type === 'DL' || /\bdelivered\b/.test(text)) {
    return /not delivered|undelivered/.test(text) ? 'in_transit' : 'delivered'
  }
  if (/cancel/.test(text)) return 'cancelled'
  if (/out for delivery/.test(text)) return 'out_for_delivery'
  if (/shipment data received|manifest|awb generated|waybill generated/.test(text)) return 'created'
  if (type === 'PU' || /picked up|pickup (done|completed)/.test(text)) return 'picked_up'
  return 'in_transit'
}

/** Blue Dart caps every address line at 30 characters: the address split over three lines. */
export function addressLines(line1: string, line2?: string): [string, string, string] {
  const words = [line1, line2].filter(Boolean).join(', ').split(/\s+/)
  const lines: string[] = ['']
  for (const word of words) {
    const current = lines[lines.length - 1] ?? ''
    const next = current ? `${current} ${word}` : word
    if (next.length <= 30) lines[lines.length - 1] = next
    else if (lines.length < 3) lines.push(word.slice(0, 30))
  }
  return [lines[0] ?? '', lines[1] ?? '', lines[2] ?? '']
}

/** Next pickup slot: today at 16:00 India time, or tomorrow once it is past 14:00 there. */
export function pickupSlot(now: Date): { date: Date; time: string } {
  const ist = new Date(now.getTime() + 330 * 60_000)
  const day = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate())
  const date = new Date(day + (ist.getUTCHours() >= 14 ? 86_400_000 : 0))
  return { date, time: '1600' }
}

export type WaybillOptions = {
  customerCode: string
  originArea: string
  productCode: string
  registerPickup: boolean
  /** Unique per booking (Blue Dart refuses a repeated one with "Waybill already generated"). */
  creditReference: string
  now: Date
}

const rupees = (paise: number) => Math.round(paise) / 100
const digits = (phone: string) => phone.replace(/\D/g, '').slice(-10)

/** The `Request` block of GenerateWayBill, from our neutral input. */
export function waybillRequest(input: CreateShipmentInput, o: WaybillOptions) {
  const cod = input.paymentMode === 'cod'
  const to = addressLines(input.to.line1, input.to.line2)
  const from = addressLines(input.from.line1, input.from.line2)
  const slot = pickupSlot(o.now)
  const pieces = 1
  return {
    Consignee: {
      ConsigneeName: input.to.name.slice(0, 30),
      ConsigneeAttention: input.to.name.slice(0, 30),
      ConsigneeAddress1: to[0],
      ConsigneeAddress2: to[1],
      ConsigneeAddress3: to[2] || input.to.city.slice(0, 30),
      ConsigneePincode: input.to.pincode,
      ConsigneeMobile: digits(input.to.phone),
      ConsigneeTelephone: '',
      ConsigneeEmailID: '',
    },
    Shipper: {
      CustomerCode: o.customerCode,
      OriginArea: o.originArea,
      CustomerName: input.from.name.slice(0, 30),
      Sender: input.from.name.slice(0, 30),
      CustomerAddress1: from[0],
      CustomerAddress2: from[1],
      CustomerAddress3: from[2] || input.from.city.slice(0, 30),
      CustomerPincode: input.from.pincode,
      CustomerMobile: digits(input.from.phone),
      CustomerTelephone: '',
      CustomerEmailID: '',
      IsToPayCustomer: false,
      VendorCode: '',
    },
    Returnadds: {
      ReturnAddress1: from[0],
      ReturnAddress2: from[1],
      ReturnAddress3: from[2] || input.from.city.slice(0, 30),
      ReturnPincode: input.from.pincode,
      ReturnMobile: digits(input.from.phone),
      ReturnContact: input.from.name.slice(0, 20),
      ReturnTelephone: '',
      ReturnEmailID: '',
      ManifestNumber: '',
    },
    Services: {
      ProductCode: o.productCode,
      // 1 = non-document (a parcel); 0 would be documents.
      ProductType: 1,
      SubProductCode: cod ? 'C' : 'P',
      PieceCount: pieces,
      ActualWeight: Math.max(0.05, Math.round(input.weightGrams) / 1000),
      DeclaredValue: rupees(input.valuePaise),
      CollectableAmount: cod ? rupees(input.codAmountPaise) : 0,
      CreditReferenceNo: o.creditReference,
      Commodity: {
        CommodityDetail1: (input.lines[0]?.title ?? 'Goods').slice(0, 30),
        CommodityDetail2: (input.lines[1]?.title ?? '').slice(0, 30),
        CommodityDetail3: (input.lines[2]?.title ?? '').slice(0, 30),
      },
      Dimensions: [],
      itemdtl: input.lines.slice(0, 10).map((l, i) => ({
        ItemID: String(i + 1),
        ItemName: l.title.slice(0, 50),
        ItemValue: rupees(l.unitPricePaise * l.quantity),
        Itemquantity: l.quantity,
      })),
      PickupDate: bluedartDate(slot.date),
      PickupTime: slot.time,
      RegisterPickup: o.registerPickup,
      PDFOutputNotRequired: false,
      SpecialInstruction: '',
      PackType: '',
      noOfDCGiven: 0,
    },
  }
}
