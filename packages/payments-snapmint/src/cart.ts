/**
 * SOURCE OF TRUTH KEYWORDS: buildSnapmintCart, buildSnapmintOrderId, snapmintMobile, splitName, paiseToRupees
 * WHAT:  Our payment request turned into the body of Snapmint's create-checkout call
 *        (`POST /api/pub/carts`, integration document v20250722 section 5.1): rupees (not paise),
 *        the shopper's name in three parts, addresses, products, and the return URLs.
 * WHY:   Pure, so every mapping rule is tested without a network.
 * WHERE: SnapmintProvider.createPayment (snapmint.ts); the visibility check reuses the helpers.
 */
import type { CreatePaymentInput, PaymentShipping } from '@commerce/payments'

/** Section 8.1: the visibility check is built for order values up to ₹10,000; send 10,000 above. */
export const VISIBILITY_ORDER_VALUE_CAP = 10_000

/** Our own cap on `merchantOrderId`; Snapmint documents no length or character rules. */
const ORDER_ID_MAX_LEN = 40

/** Integer paise to rupees with two decimals, as a number (`12345` → `123.45`). */
export const paiseToRupees = (paise: number): number => Number((paise / 100).toFixed(2))

/** Rupees as Snapmint reports them (number or text) to integer paise; NaN when not a number. */
export function rupeesToPaise(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : Number.NaN
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN
}

/** A 10-digit Indian mobile (starts 6-9), with any +91 or leading 0 taken off; else null. */
export function snapmintMobile(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits
  const trimmed = local.length === 11 && local.startsWith('0') ? local.slice(1) : local
  return /^[6-9]\d{9}$/.test(trimmed) ? trimmed : null
}

/** "Asha Rani Verma" → first Asha, middle Rani, last Verma; one word is the first name only. */
export function splitName(full: string | null | undefined): {
  firstName: string
  middleName: string
  lastName: string
} {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0] ?? '', middleName: '', lastName: '' }
  return {
    firstName: parts[0] ?? '',
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts.at(-1) ?? '',
  }
}

/** A plausible IPv4 or IPv6 address (our `clientIp` answers 'unknown' when it has none). */
export const isIp = (v: string | null | undefined): v is string =>
  !!v && (/^\d{1,3}(\.\d{1,3}){3}$/.test(v) || (/^[0-9a-f:.]+$/i.test(v) && v.includes(':')))

/**
 * `o<orderNumber>_<first 8 hex of orderId>_<attempt>` (`d<draftNumber>_…` for a checkout
 * draft), letters, digits, `_` and `-` only. A new attempt gets a new id: Snapmint refuses a
 * repeated one (`DUPLICATE_MERCHANT_OID`).
 */
export function buildSnapmintOrderId(input: CreatePaymentInput): string {
  const numberPart =
    input.orderNumber != null
      ? `o${input.orderNumber}`
      : input.draftNumber != null
        ? `d${input.draftNumber}`
        : 'o'
  const idPart = input.orderId.replace(/-/g, '').slice(0, 8)
  const attempt = input.idempotencyKey?.split(':').at(-1) || '1'
  return `${numberPart}_${idPart}_${attempt}`
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, ORDER_ID_MAX_LEN)
}

export type SnapmintAddress = {
  addressLine1: string
  addressLine2?: string
  zip: number
  city: string
  state: string
}

/** Section 5.1's address: a numeric PIN code and the state's name where we know it. */
export function snapmintAddress(a: PaymentShipping): SnapmintAddress {
  const out: SnapmintAddress = {
    addressLine1: a.line1,
    zip: Number(a.postalCode.replace(/\D/g, '')),
    city: a.city,
    state: a.stateName ?? a.state,
  }
  if (a.line2) out.addressLine2 = a.line2
  return out
}

/** Where Snapmint sends the shopper back: one route, the outcome told apart by the post itself. */
export const snapmintReturnUrl = (origin: string, outcome: 'success' | 'failure'): string =>
  `${origin.replace(/\/$/, '')}/checkout/return/snapmint?outcome=${outcome}`

export class SnapmintInputError extends Error {}

/**
 * The create-checkout body. Throws `SnapmintInputError` for what Snapmint would refuse anyway:
 * a currency other than INR, no 10-digit Indian mobile, no shopper IP, no delivery address or
 * no store address to come back to.
 */
export function buildSnapmintCart(
  input: CreatePaymentInput,
  merchantId: string,
): Record<string, unknown> {
  if (input.currency !== 'INR') throw new SnapmintInputError('Snapmint only takes rupee payments')
  const mobile = snapmintMobile(input.customer.phone)
  if (!mobile) throw new SnapmintInputError('Snapmint needs a 10-digit Indian mobile number')
  // Local development has no proxy header, so `clientIp` answers 'unknown': use loopback there
  // so sandbox checkouts on localhost can reach Snapmint. Anywhere else a missing IP is refused.
  const raw = input.customer.ip?.trim()
  const ip = !isIp(raw) && process.env.NODE_ENV === 'development' ? '127.0.0.1' : raw
  if (!isIp(ip)) throw new SnapmintInputError("Snapmint needs the shopper's IP address")
  if (!input.shipping) throw new SnapmintInputError('Snapmint needs a delivery address')
  if (!input.storefrontOrigin) throw new SnapmintInputError('Snapmint needs the store address')

  const name = splitName(input.customer.name ?? input.shipping.name)
  const shippingAddress = snapmintAddress(input.shipping)
  const body: Record<string, unknown> = {
    merchantOrderId: buildSnapmintOrderId(input),
    // Section 5.1 types orderValue as a string; rupees with two decimals.
    orderValue: (input.amountPaise / 100).toFixed(2),
    ip,
    products: (input.lines ?? []).map((l) => ({
      sku: l.sku ?? '',
      name: l.title,
      unitPrice: paiseToRupees(l.unitPricePaise),
      quantity: l.quantity,
      itemUrl: '',
    })),
    // The document's sample sends a number; an id that is not all digits goes as given.
    merchantId: /^\d+$/.test(merchantId) ? Number(merchantId) : merchantId,
    merchantConfirmationUrl: snapmintReturnUrl(input.storefrontOrigin, 'success'),
    merchantFailureUrl: snapmintReturnUrl(input.storefrontOrigin, 'failure'),
    mobile,
    ...name,
    billingAddress: input.billing ? snapmintAddress(input.billing) : shippingAddress,
    shippingAddress,
  }
  // A phone-only checkout has no email; Snapmint lists no error for a missing one.
  if (input.customer.email) body.email = input.customer.email
  return body
}
