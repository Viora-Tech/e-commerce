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
