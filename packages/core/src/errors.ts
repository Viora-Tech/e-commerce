import { formatMoney } from '@commerce/money'

export class CommerceError extends Error {
  readonly code: string
  readonly storeId: string | undefined
  override readonly cause: unknown

  constructor(
    code: string,
    message: string,
    opts: { storeId?: string | undefined; cause?: unknown } = {},
  ) {
    super(message)
    this.name = new.target.name
    this.code = code
    this.storeId = opts.storeId
    this.cause = opts.cause
  }
}

export class OutOfStock extends CommerceError {
  readonly variantId: string

  constructor(variantId: string, storeId?: string) {
    super('OUT_OF_STOCK', `Variant ${variantId} has insufficient stock`, { storeId })
    this.variantId = variantId
  }
}

/** Settings → Checkout → Cart limit (#156): more of one product than one cart may hold. */
export class CartLimitExceeded extends CommerceError {
  readonly productId: string
  readonly title: string
  readonly max: number

  constructor(productId: string, title: string, max: number, storeId?: string) {
    super('CART_LIMIT', `At most ${max} of product ${productId} per cart`, { storeId })
    this.productId = productId
    this.title = title
    this.max = max
  }
}

/** Settings → Payments → Payment rules (#150): a rule hides the picked way to pay for this order. */
export class PaymentMethodHidden extends CommerceError {
  readonly methodId: string

  constructor(methodId: string, storeId?: string) {
    super('PAYMENT_METHOD_HIDDEN', `Payment method ${methodId} is hidden for this order`, {
      storeId,
    })
    this.methodId = methodId
  }
}

export class CartNotOpen extends CommerceError {
  constructor(cartId: string, storeId?: string) {
    super('CART_NOT_OPEN', `Cart ${cartId} is not open`, { storeId })
  }
}

export class CartEmpty extends CommerceError {
  constructor(cartId: string, storeId?: string) {
    super('CART_EMPTY', `Cart ${cartId} has no lines`, { storeId })
  }
}

/**
 * The discount ran out between the preview and the order: its usage limit, or
 * this shopper's cap, was reached by a checkout that committed first. The order
 * is not placed; submitting again prices the cart without it.
 */
export class DiscountUnavailable extends CommerceError {
  constructor(discountId: string, storeId?: string) {
    super('DISCOUNT_UNAVAILABLE', `Discount ${discountId} has reached its usage limit`, {
      storeId,
    })
  }
}

/**
 * The code on the cart does not work for this checkout, found only now that the contact is known
 * (one use per customer, a customer-only code, a segment). The order is not placed: the shopper
 * saw the discount in the summary and must not be charged the full price without being told.
 */
export class DiscountCodeRefused extends CommerceError {
  readonly code: string
  readonly reason: string
  constructor(code: string, reason: string, storeId?: string) {
    super('DISCOUNT_CODE_REFUSED', `Discount code ${code} refused: ${reason}`, { storeId })
    this.code = code
    this.reason = reason
  }
}

export class PaymentFailed extends CommerceError {
  constructor(provider: string, cause?: unknown, storeId?: string) {
    super('PAYMENT_FAILED', `Payment via ${provider} failed`, { storeId, cause })
  }
}

/** The store has shipping zones but none covers this address, or no rate fits the cart. */
/**
 * No warehouse may send these goods to the buyer's state: the only ones that could are billed
 * under a composition GSTIN, which cannot supply goods to another state (order/routing.ts).
 */
export class CannotShipToState extends CommerceError {
  constructor(stateCode: string | null, storeId?: string) {
    super('CANNOT_SHIP_TO_STATE', `No location may ship to ${stateCode ?? 'this state'}`, {
      storeId,
    })
  }
}

export class ShippingUnavailable extends CommerceError {
  constructor(pincode: string, storeId?: string) {
    super('SHIPPING_UNAVAILABLE', `No shipping rate covers ${pincode}`, { storeId })
  }
}

/** The rate the shopper picked no longer applies (the cart or the rates changed). */
export class ShippingRateUnavailable extends CommerceError {
  constructor(rateId: string, storeId?: string) {
    super('SHIPPING_RATE_UNAVAILABLE', `Shipping rate ${rateId} does not apply to this order`, {
      storeId,
    })
  }
}

/** The variant is listed without a price (#913): it shows on the storefront but cannot be bought. */
export class PriceNotSet extends CommerceError {
  readonly variantId: string

  constructor(variantId: string, storeId?: string) {
    super('PRICE_NOT_SET', `Variant ${variantId} has no price yet`, { storeId })
    this.variantId = variantId
  }
}

/**
 * The variant is hidden on the storefront (#934): staff can still use it in drafts and order edits,
 * but a shopper's cart and checkout cannot.
 */
export class VariantHidden extends CommerceError {
  readonly variantId: string

  constructor(variantId: string, storeId?: string) {
    super('VARIANT_HIDDEN', `Variant ${variantId} is hidden on the storefront`, { storeId })
    this.variantId = variantId
  }
}

/**
 * The shopper's market sells from a catalog (Markets › Catalogs) that leaves this product out:
 * it shows as not available in their country, and the cart and checkout refuse it.
 */
export class NotSoldInMarket extends CommerceError {
  readonly variantId: string

  constructor(variantId: string, storeId?: string) {
    super('NOT_SOLD_IN_MARKET', `Variant ${variantId} is not sold in this market`, { storeId })
    this.variantId = variantId
  }
}

/** A product's `launchAt` has not passed: nothing can be added to cart or ordered yet. */
export class NotLaunchedYet extends CommerceError {
  constructor(variantId: string, launchAt: Date, storeId?: string) {
    super('NOT_LAUNCHED_YET', `Variant ${variantId} launches at ${launchAt.toISOString()}`, {
      storeId,
    })
  }
}

/** Pre-order is off (or stock plus the pre-order limit is exhausted) and the variant is out of stock. */
export class PreorderLimitReached extends CommerceError {
  constructor(variantId: string, storeId?: string) {
    super('PREORDER_LIMIT_REACHED', `Variant ${variantId} has reached its pre-order limit`, {
      storeId,
    })
  }
}

/** Fulfilment is blocked while a deposit-mode pre-order still has a balance due. */
export class BalanceDue extends CommerceError {
  constructor(orderId: string, balancePaise: number, storeId?: string) {
    super(
      'BALANCE_DUE',
      `Order ${orderId} cannot be fulfilled until its ${formatMoney(balancePaise, 'INR', { showZeroDecimals: true })} balance is paid`,
      { storeId },
    )
  }
}

/**
 * The checkout broke one of the store's checkout rules (Settings → Checkout):
 * a contact field, the minimum order, or a cash on delivery limit. Thrown by
 * `placeOrder` before anything is reserved, whatever the storefront showed.
 */
export class CheckoutRuleViolation extends CommerceError {
  readonly rule:
    | 'contact'
    | 'minimum_order'
    | 'cod_blocked_pincode'
    | 'cod_over_limit'
    /** The address's state cannot be right for its PIN code (`checkout/pincode-state.ts`). */
    | 'state_mismatch'
    /** COD & RTO app: the store refuses cash on delivery for high-risk orders. */
    | 'cod_high_risk'
    /** Delivery options app: the picked option (Express) is prepaid only. */
    | 'cod_prepaid_only_option'
  readonly fields: Readonly<Record<string, string>>
  /** Minimum order: what is still missing. COD limit: the limit. In paise. */
  readonly amountPaise: number | null

  constructor(
    rule: CheckoutRuleViolation['rule'],
    opts: {
      storeId?: string | undefined
      fields?: Record<string, string>
      amountPaise?: number
    } = {},
  ) {
    super('CHECKOUT_RULE', `Checkout rule "${rule}" was not met`, { storeId: opts.storeId })
    this.rule = rule
    this.fields = opts.fields ?? {}
    this.amountPaise = opts.amountPaise ?? null
  }
}

/**
 * A pre-order campaign keeps its pre-orders apart from in-stock goods (`mixed_cart: 'block'`,
 * #143): the cart or checkout refuses the mix. `shopperMessage` is the campaign's own words,
 * null when it has none (the storefront then says it in its own).
 */
export class PreorderMixedCart extends CommerceError {
  readonly shopperMessage: string | null
  readonly campaignName: string | null

  constructor(shopperMessage: string | null, campaignName: string | null, storeId?: string) {
    super(
      'PREORDER_MIXED_CART',
      shopperMessage ?? 'Pre-orders must be checked out on their own, without in-stock items',
      { storeId },
    )
    this.shopperMessage = shopperMessage
    this.campaignName = campaignName
  }
}
