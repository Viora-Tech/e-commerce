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
  constructor(variantId: string, storeId?: string) {
    super('OUT_OF_STOCK', `Variant ${variantId} has insufficient stock`, { storeId })
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

export class PaymentFailed extends CommerceError {
  constructor(provider: string, cause?: unknown, storeId?: string) {
    super('PAYMENT_FAILED', `Payment via ${provider} failed`, { storeId, cause })
  }
}

/** The store has shipping zones but none covers this address, or no rate fits the cart. */
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
      `Order ${orderId} cannot be fulfilled until its ₹${(balancePaise / 100).toFixed(2)} balance is paid`,
      { storeId },
    )
  }
}
