/** SOURCE OF TRUTH: CheckoutDetails, PlaceOrderInput, PlaceOrderResult, Line, State
 * WHAT:  The checkout's input and result, and the cart lines and workflow state its steps share.
 * WHY:   Split from place-order.ts (#973) so the steps can live in sibling modules; the public
 *        types are re-exported from place-order.ts, so callers import them from there as before.
 */
import type {
  MarketingAttribution,
  OrderDeliveryRoute,
  ParcelDeliveryEstimate,
  PixelTracking,
} from '@commerce/db'
import type { CheckoutSession, PaymentProvider } from '@commerce/payments'
import type { CheckoutContact } from '../checkout/settings'
import type { CheckoutRisk } from '../cod-rto/risk'
import type { StoreContext } from '../context'
import type { ResolvedDiscount } from '../discounts/resolve'
import type { GiftCardRedemption } from '../gift-cards/service'
import type { FallbackTry } from '../payments/fallback'
import type { PaymentRowStatus } from '../payments/transitions'
import type { PreorderCampaignTerms } from '../preorder/campaigns'
import type { resolvePreorderSettings } from '../preorder/settings'
import type { OrderDeliveryInput } from '../shipping/delivery-options/order'
import type { ShippingRateOption } from '../shipping/rates'
import type { RoutedParcel } from './routing'
import type { ReservedUnits } from './routing-service'

export type CheckoutDetails = {
  /** Blank is allowed only when Settings → Checkout makes email optional. */
  email: string
  phone: string
  /** The full name. With Settings → Checkout splitting it (#154), the parts come too. */
  name: string
  firstName?: string | null | undefined
  lastName?: string | null | undefined
  address: {
    line1: string
    line2?: string
    city: string
    stateCode: string
    pincode: string
    /** ISO 3166-1; left out means India (country zones price an address abroad, audit #160). */
    countryCode?: string | undefined
  }
  /** Business buyer's GSTIN; kept only when the store shows the GSTIN field and it validates. */
  gstin?: string | null | undefined
  businessName?: string | null | undefined
  /** Kept only when the store turned order notes on. */
  note?: string | null | undefined
  /**
   * The shopper ticked "Email me news and offers" / "Send me offers on WhatsApp" (audit #153).
   * A tick grants consent (source `checkout`); no tick never takes an earlier consent away.
   */
  marketing?: { email?: boolean | undefined; whatsapp?: boolean | undefined } | undefined
}

export type PlaceOrderInput = {
  cartId: string
  paymentProvider: PaymentProvider
  /**
   * Gateways to try, in order, when `paymentProvider` cannot open the payment (an error, or no
   * answer in time): the store's fallback order (`fallbackChain`). Empty or unset: no fallback.
   */
  paymentFallbacks?: FallbackTry<PaymentProvider>[] | undefined
  /** Optional in tests; required by the storefront checkout. */
  checkout?: CheckoutDetails
  /**
   * The delivery window checkout showed for parcels from each location (by location id), from
   * the courier's estimate. Stored on the parcels that ship from there; a parcel routed to a
   * location checkout did not preview gets none.
   */
  deliveryEstimates?: Readonly<Record<string, ParcelDeliveryEstimate>> | undefined
  /**
   * `SETTINGS_SECRET` (the caller already has it — see `packages/api/src/routers/*`'s
   * `secret()` helper), used to encrypt the new/updated `customer.phone` on the customer
   * row created or matched here. Omitted (most tests, and any caller that hasn't been
   * updated yet): `customer.phone` is written in clear, same as before this column was
   * encrypted — `decryptCustomerPhone` reads plaintext rows through unchanged either way.
   */
  secret?: string | undefined
  /** Overrides the code saved on the cart; re-validated here regardless of what the client showed. */
  discountCode?: string | null
  /** Cards the shopper applied (ids from `findRedeemableGiftCard`), spent before the provider is charged. */
  giftCardIds?: readonly string[]
  /**
   * Spend this customer's store credit on what is left after gift cards. Only for a signed-in
   * shopper (the storefront passes the session's customer, never one from the form); the order's
   * customer must be the same one. Left out: no store credit is used.
   */
  storeCredit?: { customerId: string } | undefined
  /**
   * The shipping rate the shopper picked. Re-priced here; a rate that no longer
   * applies throws `ShippingRateUnavailable`. Omitted: the cheapest that applies.
   */
  shippingRateId?: string | null | undefined
  /** Delivery options app: the choice and the quote snapshot's answers (`priceOrderDelivery`). */
  delivery?: OrderDeliveryInput | undefined
  /**
   * The shopper pressed "Yes, order again" after being told they placed these items a little
   * while ago (`DuplicateCheckout` kind `placed`). Never skips the unpaid-duplicate block.
   */
  orderAgain?: boolean | undefined
}
export type PlaceOrderResult = {
  orderId: string
  orderNumber: number
  /**
   * The payment attempt recorded with the order. `placeOrder` never calls the
   * gateway: after its transaction commits, start this attempt with
   * `startPaymentAttempt` (or use `placeOrderAndPay`). Null when gift cards and store credit
   * paid the whole order.
   */
  attemptId: string | null
  paymentStatus: PaymentRowStatus
  /** How the storefront should continue; null until the attempt has been started. */
  session: CheckoutSession | null
  /** True when the cart was already converted and this is the order from that earlier submit. */
  replayed: boolean
  /** Charged at checkout for the order's pre-order lines; 0 when none are in deposit mode. */
  depositPaise: number
  /** Deferred to later; fulfilment is blocked while this is greater than zero. */
  balanceDuePaise: number
}

export type Line = {
  variantId: string
  /** Which shipping profile the line ships under. */
  productId: string
  quantity: number
  unitPricePaise: number
  title: string
  variantTitle: string
  /** The variant's own GST rate; null falls back to the store default. */
  gstRatePercent: number | null
  taxable: boolean
  hsCode: string | null
  /** Sold as a gift card: no tax, no stock, issued on payment. */
  giftCard: boolean
  /** The variant's "requires shipping": false takes no shipping charge and never ships. */
  requiresShipping: boolean
  /** Variant weight; null counts as 0 for weight-based rates. */
  weightGrams: number | null
  /** The variant's weighted average cost now: snapshotted as the line's cost at sale. */
  costPaise: number | null
  /** Store-timezone instant the product goes on sale; null = always on sale. */
  launchAt: Date | null
  /** Resolved pre-order settings (product merged with the variant's override, if any). */
  preorder: ReturnType<typeof resolvePreorderSettings>
  /**
   * The note to keep on the order line (#936): the product's own, or its campaign's order note
   * (#144); null falls back to the store's.
   */
  preorderNote: string | null
  /** The pre-order campaign the line sells under (#142); absent outside one. */
  preorderCampaign?: Pick<PreorderCampaignTerms, 'id' | 'name' | 'mixedCart' | 'content'> | null
}

export type State = {
  ctx: StoreContext
  input: PlaceOrderInput
  lines: Line[]
  cartDiscountCode: string | null
  /** The cart's marketing touch, copied onto the order for attribution. */
  cartAttribution: MarketingAttribution | null
  /** The cart's pixel tracking (fbp/fbc, IP, UA, consent), copied onto the order for the Pixels app. */
  cartTracking: PixelTracking | null
  discount: ResolvedDiscount | null
  /** The rate charged; null when nothing ships or the store has no rates. */
  shipping: ShippingRateOption | null
  /** Delivery options app: the option and route saved on the order; null on zone rates. */
  delivery: OrderDeliveryRoute | null
  /** The zone rate behind a delivery option placed on backup, for `order.shipping_rate_id`. */
  backupRateId: string | null
  /** Contact fields as Settings → Checkout allows them; null without checkout details. */
  contact: CheckoutContact | null
  /** Where the goods ship from, by line index (`key`); empty for gift cards only. */
  parcels: RoutedParcel[]
  reserved: ReservedUnits[]
  orderId: string | null
  orderNumber: number | null
  /** Order total: subtotal less discount, plus the payment-method fee or discount and shipping. */
  totalPaise: number
  /** Part of the total paid from gift cards; the provider is asked for the rest. */
  giftCardPaise: number
  redemptions: GiftCardRedemption[]
  /** Part of what is due now taken from the customer's store credit (held or captured). */
  storeCreditPaise: number
  attemptId: string | null
  /** Deposit charged now and balance deferred, from the order's pre-order lines. Both 0 when none. */
  depositPaise: number
  balanceDuePaise: number
  /** COD & RTO app: the order's RTO risk and whether to ask for COD confirmation; null without it. */
  risk: CheckoutRisk | null
}
