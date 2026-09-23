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
