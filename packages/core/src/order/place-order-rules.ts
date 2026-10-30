/** SOURCE OF TRUTH: checkGiftCardRules, checkCheckoutPincode, paymentAdjustmentFor, lineGstRate
 * WHAT:  The small rules checkout prices and checks with: gift-card checkout limits, the payment
 *        fee (a rate's COD fee or the store's), each line's GST rate, the PIN code check (or
 *        the postcode check abroad),
 *        and what is charged now versus left to gift cards or a pre-order balance.
 * WHY:   Split from place-order.ts (#973); `checkGiftCardRules` is re-exported from there.
 */
import { loadPincodeDirectory } from '@commerce/shipping/pincode-directory'
import {
  abroadAddressErrors,
  abroadRegion,
  checkoutCountry,
  cleanPostalCode,
  isAbroad,
} from '../checkout/address-abroad'
import { stateMatchesPincode } from '../checkout/pincode-state'
import { checkoutPincode } from '../checkout/settings'
import { CheckoutRuleViolation } from '../errors'
import { GiftCardError } from '../gift-cards/service'
import type { PaymentAdjustment } from '../payments/adjustments'
import type { ShippingRateOption } from '../shipping/rates'
import { chargedGstRate, type StoreTaxSettings } from '../tax/settings'
import type { CheckoutDetails, Line, PlaceOrderInput, State } from './place-order-types'

/** The cart lines at their snapshot prices, before any discount. */
export const sumPaise = (lines: Line[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

/**
 * Gift cards are vouchers, not goods: a card is checked out on its own, paid
 * online (no COD, and not with another gift card), and takes no discount, so
 * a code can never turn store credit into cash at a discount.
 */
export function checkGiftCardRules(
  lines: readonly Pick<Line, 'giftCard'>[],
  input: Pick<PlaceOrderInput, 'paymentProvider' | 'giftCardIds'>,
  storeId?: string,
): void {
  const buyingCards = lines.some((l) => l.giftCard)
  if (!buyingCards) return
  if (lines.some((l) => !l.giftCard)) {
    throw new GiftCardError(
      'not_allowed',
      'Gift cards are checked out on their own. Remove the other items or the gift card.',
      storeId,
    )
  }
  if (input.giftCardIds?.length) {
    throw new GiftCardError(
      'not_allowed',
      'Gift cards cannot be paid for with a gift card',
      storeId,
    )
  }
  if (input.paymentProvider.id === 'cod') {
    throw new GiftCardError('not_allowed', 'Gift cards need to be paid online', storeId)
  }
}

/**
 * The payment fee for this order. Cash on delivery takes the rate's own COD
 * fee when the rate sets one, instead of the store's (Settings → Payments),
 * never both; a rate without one leaves the store's fee in place.
 */
export function paymentAdjustmentFor(
  providerId: string,
  storeAdjustment: PaymentAdjustment | undefined,
  shipping: ShippingRateOption | null,
): PaymentAdjustment | undefined {
  if (providerId !== 'cod' || shipping?.codSurchargePaise == null) return storeAdjustment
  return {
    type: 'fixed',
    value: shipping.codSurchargePaise,
    label: storeAdjustment?.label || 'Cash on delivery fee',
  }
}

/**
 * GST at the line's rate; a gift card sale is a voucher, taxed only when it is
 * redeemed. A composition-scheme store charges no GST on anything.
 */
export const lineGstRate = (l: Line, storeRate: number, tax: StoreTaxSettings): number =>
  l.giftCard || !l.taxable ? 0 : chargedGstRate(l.gstRatePercent ?? storeRate, tax)

/** The India Post directory's state for a PIN code, when the directory file is installed. */
async function directoryState(pincode: string): Promise<string | null> {
  try {
    return (await loadPincodeDirectory())?.lookup(pincode)?.stateCode ?? null
  } catch {
    // A broken directory file must not stop checkout; the PIN prefix table still applies.
    return null
  }
}

/**
 * The checkout with one spelling of the PIN code for every rule and for the stored address. The
 * state picks the shipping zone and the GST split, so it must agree with the PIN.
 */
export async function checkCheckoutPincode(
  storeId: string,
  checkout: CheckoutDetails,
): Promise<CheckoutDetails> {
  if (isAbroad(checkout.address.countryCode)) return checkAbroadAddress(storeId, checkout)
  const pincode = checkoutPincode(checkout.address.pincode)
  if (!pincode) {
    throw new CheckoutRuleViolation('contact', {
      storeId,
      fields: { pincode: 'Enter a valid 6-digit PIN code' },
    })
  }
  if (!stateMatchesPincode(pincode, checkout.address.stateCode, await directoryState(pincode))) {
    throw new CheckoutRuleViolation('state_mismatch', {
      storeId,
      fields: { stateCode: 'The state does not match this PIN code' },
    })
  }
  return { ...checkout, address: { ...checkout.address, pincode, countryCode: 'IN' } }
}

/** Server messages for an address abroad; the storefront shows its own words first. */
export const ABROAD_MESSAGES = {
  postcode: 'Enter the postcode',
  postcodeInvalid: 'Enter a valid postcode for this country',
  region: 'Enter the state or province',
  regionInvalid: 'Pick the state or province from the list',
} as const

/**
 * An address abroad as it is judged and stored: the country upper case, the postcode cleaned
 * and checked loosely for its country, the region (kept in `stateCode`, as Shopify imports
 * keep it) as its code where the country's regions are listed, else as typed. No PIN code or
 * Indian state check: those are India's.
 */
export function checkAbroadAddress(storeId: string, checkout: CheckoutDetails): CheckoutDetails {
  const countryCode = checkoutCountry(checkout.address.countryCode)
  const fields = abroadAddressErrors(
    { countryCode, stateCode: checkout.address.stateCode, pincode: checkout.address.pincode },
    ABROAD_MESSAGES,
  )
  if (Object.keys(fields).length > 0) {
    throw new CheckoutRuleViolation('contact', { storeId, fields })
  }
  return {
    ...checkout,
    address: {
      ...checkout.address,
      countryCode,
      // A listed country's region as its code ("CA"), which couriers abroad need.
      stateCode: abroadRegion(countryCode, checkout.address.stateCode)?.code ?? '',
      pincode: cleanPostalCode(checkout.address.pincode),
    },
  }
}

/** What must be collected today: the order total less whatever a deposit-mode pre-order defers. */
export const chargeNowPaise = (s: Pick<State, 'totalPaise' | 'balanceDuePaise'>): number =>
  s.totalPaise - s.balanceDuePaise

/** True when gift cards paid the whole order and no provider is involved. */
export const paidByCards = (
  s: Pick<State, 'giftCardPaise' | 'totalPaise' | 'balanceDuePaise'>,
): boolean => s.giftCardPaise > 0 && s.giftCardPaise >= chargeNowPaise(s)
