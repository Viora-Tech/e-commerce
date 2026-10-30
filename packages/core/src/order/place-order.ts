import {
  address,
  cart,
  cartLine,
  customer,
  type Db,
  type MarketingAttribution,
  newId,
  type OrderDeliveryRoute,
  order,
  orderLine,
  type ParcelDeliveryEstimate,
  type PixelTracking,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import type { CheckoutSession, PaymentProvider } from '@commerce/payments'
import { loadPincodeDirectory } from '@commerce/shipping/pincode-directory'
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm'
import { stateMatchesPincode } from '../checkout/pincode-state'
import {
  type CheckoutContact,
  checkCheckoutRules,
  checkoutPincode,
  checkoutRuleSubtotalPaise,
  parseCheckoutSettings,
} from '../checkout/settings'
import { requestCodConfirmation } from '../cod-rto/confirm'
import { assessCheckoutRisk, type CheckoutRisk, tagsForRisk } from '../cod-rto/risk'
import type { StoreContext } from '../context'
import { recordCustomerChange } from '../customers/changes'
import { encryptCustomerPhone, phoneBlindIndex } from '../customers/phone-crypto'
import { applyDiscount } from '../discounts/evaluate'
import { type ResolvedDiscount, resolveCartDiscount } from '../discounts/resolve'
import { recordDiscountUses, releaseDiscountUses } from '../discounts/usage'
import {
  CartEmpty,
  CartNotOpen,
  CheckoutRuleViolation,
  DiscountCodeRefused,
  NotLaunchedYet,
  NotSoldInMarket,
  PriceNotSet,
  ShippingRateUnavailable,
  ShippingUnavailable,
  VariantHidden,
} from '../errors'
import {
  GIFT_CARD_PROVIDER,
  GiftCardError,
  type GiftCardRedemption,
  redeemGiftCards,
  reverseGiftCardRedemptions,
} from '../gift-cards/service'
import { unsoldInMarket } from '../markets/catalogs'
import { insertOutboxEvent } from '../outbox/write'
import { applyPaymentAdjustment, type PaymentAdjustment } from '../payments/adjustments'
import {
  createPaymentAttempt,
  startPaymentAttempt,
  startPaymentWithFallback,
} from '../payments/attempts'
import type { FallbackTry } from '../payments/fallback'
import { GATEWAY_START_TIMEOUT_MS } from '../payments/routing'
import { parsePaymentSettings } from '../payments/settings'
import type { PaymentRowStatus } from '../payments/transitions'
import { computeDepositFromSettings } from '../preorder/deposit'
import { isLaunched } from '../preorder/launch'
import { preorderNoteText } from '../preorder/note'
import { resolvePreorderSettings, resolveShipDate } from '../preorder/settings'
import { parsePreorderStoreSettings } from '../preorder/store-settings'
import { setMarketingConsents } from '../privacy/marketing-consent'
import { StoreAddressSchema } from '../settings/general'
import { type OrderDeliveryInput, priceOrderDelivery } from '../shipping/delivery-options/order'
import { primaryRateId } from '../shipping/profiles'
import { quoteProfileLines } from '../shipping/profiles-service'
import type { ShippingRateOption } from '../shipping/rates'
import { computeOrderGst } from '../tax/gst'
import { chargedGstRate, parseStoreTax, type StoreTaxSettings } from '../tax/settings'
import { runWorkflow, type WorkflowLog, type WorkflowStep } from '../workflow/run'
import { createFulfillmentOrders, deleteFulfillmentOrders } from './fulfillment-orders'
import { takeOrderNumber } from './order-number'
import { taxParcels } from './parcel-tax'
import { recomputeOrderStatuses } from './recompute'
import type { RoutedParcel } from './routing'
import { type ReservedUnits, releaseReserved, routeAndReserve } from './routing-service'

export type CheckoutDetails = {
  /** Blank is allowed only when Settings → Checkout makes email optional. */
  email: string
  phone: string
  name: string
  address: { line1: string; line2?: string; city: string; stateCode: string; pincode: string }
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
   * The shipping rate the shopper picked. Re-priced here; a rate that no longer
   * applies throws `ShippingRateUnavailable`. Omitted: the cheapest that applies.
   */
  shippingRateId?: string | null | undefined
  /** Delivery options app: the choice and the quote snapshot's answers (`priceOrderDelivery`). */
  delivery?: OrderDeliveryInput | undefined
}
export type PlaceOrderResult = {
  orderId: string
  orderNumber: number
  /**
   * The payment attempt recorded with the order. `placeOrder` never calls the
   * gateway: after its transaction commits, start this attempt with
   * `startPaymentAttempt` (or use `placeOrderAndPay`). Null when gift cards
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

type Line = {
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
  /** Variant weight; null counts as 0 for weight-based rates. */
  weightGrams: number | null
  /** The variant's weighted average cost now: snapshotted as the line's cost at sale. */
  costPaise: number | null
  /** Store-timezone instant the product goes on sale; null = always on sale. */
  launchAt: Date | null
  /** Resolved pre-order settings (product merged with the variant's override, if any). */
  preorder: ReturnType<typeof resolvePreorderSettings>
  /** The product's own pre-order note (#936); null falls back to the store's. */
  preorderNote: string | null
}

type State = {
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
  attemptId: string | null
  /** Deposit charged now and balance deferred, from the order's pre-order lines. Both 0 when none. */
  depositPaise: number
  balanceDuePaise: number
  /** COD & RTO app: the order's RTO risk and whether to ask for COD confirmation; null without it. */
  risk: CheckoutRisk | null
}

const sumPaise = (lines: Line[]): number =>
  lines.reduce((sum, l) => sum + l.quantity * l.unitPricePaise, 0)

const loadCart: WorkflowStep<State> = {
  name: 'loadCart',
  async run({ ctx, input }) {
    const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, input.cartId))
    if (c?.status !== 'open') throw new CartNotOpen(input.cartId, ctx.storeId)
    const rows = await ctx.tx
      .select({
        variantId: cartLine.variantId,
        productId: product.id,
        quantity: cartLine.quantity,
        unitPricePaise: cartLine.unitPricePaise,
        variantPricePaise: variant.pricePaise,
        hiddenOnStore: variant.hiddenOnStore,
        productId: product.id,
        title: product.title,
        variantTitle: variant.title,
        gstRatePercent: variant.gstRatePercent,
        taxable: variant.taxable,
        hsCode: variant.hsCode,
        giftCard: product.isGiftCard,
        weightGrams: variant.weightGrams,
        costPaise: variant.costPaise,
        launchAt: product.launchAt,
        preorderOverride: variant.preorderOverride,
        preorderEnabled: product.preorderEnabled,
        preorderShipDate: product.preorderShipDate,
        preorderShipsInDays: product.preorderShipsInDays,
        preorderLimit: product.preorderLimit,
        preorderButtonLabel: product.preorderButtonLabel,
        preorderNote: product.preorderNote,
        preorderPaymentMode: product.preorderPaymentMode,
        preorderDepositPaise: product.preorderDepositPaise,
        preorderDepositPercent: product.preorderDepositPercent,
      })
      .from(cartLine)
      .innerJoin(variant, eq(variant.id, cartLine.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(eq(cartLine.cartId, input.cartId))
    if (rows.length === 0) throw new CartEmpty(input.cartId, ctx.storeId)
    // The cart snapshots the price, but a price withdrawn since (#913) stops the order.
    const unpriced = rows.find((r) => r.variantPricePaise == null)
    if (unpriced) throw new PriceNotSet(unpriced.variantId, ctx.storeId)
    // Hidden after it went into the cart (#934): the shopper can no longer buy it.
    const hidden = rows.find((r) => r.hiddenOnStore)
    if (hidden) throw new VariantHidden(hidden.variantId, ctx.storeId)
    // The cart's market sells from a catalog that leaves it out (Markets › Catalogs).
    const unsold = new Set(
      await unsoldInMarket(
        ctx.tx,
        c.marketId,
        rows.map((r) => r.productId),
      ),
    )
    const outside = rows.find((r) => unsold.has(r.productId))
    if (outside) throw new NotSoldInMarket(outside.variantId, ctx.storeId)
    const lines: Line[] = rows.map((r) => ({
      variantId: r.variantId,
      productId: r.productId,
      quantity: r.quantity,
      unitPricePaise: r.unitPricePaise,
      title: r.title,
      variantTitle: r.variantTitle,
      gstRatePercent: r.gstRatePercent,
      taxable: r.taxable,
      hsCode: r.hsCode,
      giftCard: r.giftCard,
      weightGrams: r.weightGrams,
      costPaise: r.costPaise,
      launchAt: r.launchAt,
      preorder: resolvePreorderSettings(r, r.preorderOverride),
      preorderNote: r.preorderNote,
    }))
    checkGiftCardRules(lines, input, ctx.storeId)
    return {
      lines,
      cartDiscountCode: c.discountCode,
      cartAttribution: c.attribution ?? null,
      cartTracking: c.tracking ?? null,
    }
  },
}

/** Nothing before `launchAt` can be added to a cart or ordered; server-enforced regardless of the client. */
const enforceLaunch: WorkflowStep<State> = {
  name: 'enforceLaunch',
  async run({ ctx, lines }) {
    const now = new Date()
    for (const line of lines) {
      if (!isLaunched(line.launchAt, now))
        throw new NotLaunchedYet(line.variantId, line.launchAt as Date, ctx.storeId)
    }
    return {}
  },
}

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
 * Decide the discount inside the transaction, from the rules as they are now. A code the
 * shopper entered that does not work for this contact (one use per customer, customers only)
 * stops the order with `DiscountCodeRefused`: dropping it quietly charged the full price while
 * the summary still showed the discount (Razorpay asked for more than the page said).
 */
const resolveDiscount: WorkflowStep<State> = {
  name: 'resolveDiscount',
  async run({ ctx, input, cartDiscountCode, lines }) {
    if (lines.some((l) => l.giftCard)) return { discount: null }
    const code = input.discountCode === undefined ? cartDiscountCode : input.discountCode
    const { outcome, codeRejected } = await resolveCartDiscount(ctx, input.cartId, code, {
      email: input.checkout?.email,
      stateCode: input.checkout?.address?.stateCode,
    })
    if (code && codeRejected) throw new DiscountCodeRefused(code, codeRejected, ctx.storeId)
    return { discount: outcome }
  },
}

/**
 * Price shipping from the store's zones and rates, never from the client.
 * Bands and thresholds read the subtotal after the discount, the same number
 * the checkout preview used. A store with no zones ships free, as before
 * rates existed; a store with zones refuses an address none of them covers.
 */
const resolveShipping: WorkflowStep<State> = {
  name: 'resolveShipping',
  async run({ ctx, input, lines, discount: applied }) {
    const to = input.checkout?.address
    if (!to || lines.every((l) => l.giftCard)) return { shipping: null }
    const { discountedSubtotalPaise } = applyDiscount(sumPaise(lines), 0, applied)
    // One rate per shipping profile in the cart, summed (rule in shipping/profiles.ts).
    const { quote } = await quoteProfileLines(ctx.tx, lines, discountedSubtotalPaise, {
      stateCode: to.stateCode,
      pincode: to.pincode,
    })
    const fromApp = input.delivery
      ? await priceOrderDelivery(ctx, input.delivery, {
          lines,
          valuePaise: discountedSubtotalPaise,
          zone: quote,
          payment: input.paymentProvider.id === 'cod' ? 'cod' : 'prepaid',
        })
      : null
    if (fromApp) return fromApp
    if (quote.kind === 'not_configured') return { shipping: null }
    if (quote.kind === 'no_rates') throw new ShippingUnavailable(to.pincode, ctx.storeId)
    const wanted = input.shippingRateId
    const picked = wanted ? quote.options.find((o) => o.rateId === wanted) : quote.options[0]
    if (!picked) throw new ShippingRateUnavailable(wanted ?? 'none', ctx.storeId)
    return { shipping: picked }
  },
}

/**
 * Settings → Checkout, enforced on the server whatever the form showed:
 * contact fields (email required or optional, a real mobile number, a valid
 * GSTIN, the note length), the minimum order, and the cash on delivery limits.
 * Runs before stock is reserved, so a refusal leaves nothing to undo.
 */
const enforceCheckoutRules: WorkflowStep<State> = {
  name: 'enforceCheckoutRules',
  async run({ ctx, input, lines, discount: applied, shipping }) {
    const [s] = await ctx.tx
      .select({ preferences: store.preferences })
      .from(store)
      .where(eq(store.id, ctx.storeId))
    const settings = parseCheckoutSettings(s?.preferences)
    const { discountPaise, shippingPaise } = applyDiscount(
      sumPaise(lines),
      shipping?.pricePaise ?? 0,
      applied,
    )
    return {
      contact: checkCheckoutRules(settings, {
        checkout: input.checkout ?? null,
        paymentProviderId: input.paymentProvider.id,
        giftCardsOnly: lines.every((l) => l.giftCard),
        ruleSubtotalPaise: checkoutRuleSubtotalPaise(lines, discountPaise),
        shippingPaise,
        storeId: ctx.storeId,
      }),
    }
  },
}

/** COD & RTO app: score the order, and refuse COD when the store hides it for high risk. */
const assessRisk: WorkflowStep<State> = {
  name: 'assessRisk',
  async run({ ctx, input, lines, discount: applied, shipping, contact }) {
    const co = input.checkout
    if (!co || lines.every((l) => l.giftCard)) return { risk: null }
    const d = applyDiscount(sumPaise(lines), shipping?.pricePaise ?? 0, applied)
    const risk = await assessCheckoutRisk(ctx, {
      pincode: co.address.pincode,
      phone: contact?.phone ?? co.phone,
      email: contact ? contact.email : co.email,
      line1: co.address.line1,
      line2: co.address.line2,
      orderValuePaise: checkoutRuleSubtotalPaise(lines, d.discountPaise) + d.shippingPaise,
      paymentMethod: input.paymentProvider.id,
    })
    return { risk }
  },
}

/**
 * The payment fee for this order. Cash on delivery takes the rate's own COD
 * fee when the rate sets one, instead of the store's (Settings → Payments),
 * never both; a rate without one leaves the store's fee in place.
 */
function paymentAdjustmentFor(
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
 * Route the goods to warehouses and hold their stock there (order/routing.ts). Pre-order lines
 * may sell past stock within their limit; untracked goods hold nothing. Gift cards are left out.
 */
const reserveStock: WorkflowStep<State> = {
  name: 'reserveStock',
  async run({ ctx, input, lines }) {
    const { parcels, reserved } = await routeAndReserve(ctx, {
      lines: lines.map((l, i) => ({
        key: String(i),
        variantId: l.variantId,
        quantity: l.quantity,
        giftCard: l.giftCard,
        preorder: l.preorder.enabled ? { enabled: true, limit: l.preorder.limit } : null,
      })),
      buyerState: input.checkout?.address.stateCode ?? null,
    })
    return { parcels, reserved }
  },
  async compensate({ ctx, reserved }) {
    await releaseReserved(ctx, reserved)
  },
}

const createOrder: WorkflowStep<State> = {
  name: 'createOrder',
  async run({
    ctx,
    lines,
    parcels,
    input,
    discount: applied,
    cartAttribution,
    cartTracking,
    shipping,
    delivery,
    backupRateId,
    contact,
    risk,
  }) {
    let customerId: string | null = null
    let shippingAddressId: string | null = null
    if (input.checkout) {
      const co = { ...input.checkout, phone: contact?.phone ?? input.checkout.phone }
      const email = contact ? (contact.email ?? '') : co.email.trim().toLowerCase()
      const defaultAddress = {
        name: co.name,
        line1: co.address.line1,
        line2: co.address.line2 ?? null,
        city: co.address.city,
        stateCode: co.address.stateCode,
        pincode: co.address.pincode,
        country: 'IN',
        phone: co.phone,
      }
      /* One customer per email per store; a repeat order refreshes name, phone and address.
       * `customer.phone` is encrypted when the caller passed `input.secret`; the address
       * snapshot below (`address` table, `defaultAddress`) stays plaintext — see
       * `docs/security/data-protection.md`. */
      const customerPhone = input.secret
        ? encryptCustomerPhone(co.phone, input.secret).cipher
        : co.phone
      const customerPhoneIndex = input.secret ? phoneBlindIndex(co.phone, input.secret) : null
      const [cu] = !email
        ? await upsertCustomerByPhone(ctx, {
            phone: customerPhone,
            phoneIndex: customerPhoneIndex,
            name: co.name,
            defaultAddress,
          })
        : await ctx.tx
            .insert(customer)
            .values({
              storeId: ctx.storeId,
              email,
              phone: customerPhone,
              phoneIndex: customerPhoneIndex,
              name: co.name,
              defaultAddress,
            })
            .onConflictDoUpdate({
              target: [customer.storeId, customer.email],
              // Whoever types this email at checkout proved nothing: a phone proven by a
              // sign-in code stays (phone sign-in trusts it), otherwise the typed one is
              // stored unproven (`accounts/phone-proof.ts`).
              set: {
                phone: sql`case when ${customer.phoneVerifiedAt} is null then excluded.phone else ${customer.phone} end`,
                phoneIndex: sql`case when ${customer.phoneVerifiedAt} is null then excluded.phone_index else ${customer.phoneIndex} end`,
                name: co.name,
                defaultAddress,
                updatedAt: new Date(),
              },
            })
            .returning({ id: customer.id })
      const [ad] = await ctx.tx
        .insert(address)
        .values({
          storeId: ctx.storeId,
          name: co.name,
          line1: co.address.line1,
          line2: co.address.line2 ?? null,
          city: co.address.city,
          stateCode: co.address.stateCode,
          pincode: co.address.pincode,
          phone: co.phone,
        })
        .returning({ id: address.id })
      customerId = cu?.id ?? null
      shippingAddressId = ad?.id ?? null
      // A business buyer's validated GSTIN (and name) is kept on the customer for next time; a
      // checkout without them never clears what is saved.
      if (customerId && contact?.gstin) {
        await ctx.tx
          .update(customer)
          .set({
            gstin: contact.gstin,
            businessName: sql`coalesce(${contact.businessName}, ${customer.businessName})`,
          })
          .where(eq(customer.id, customerId))
      }
      // Created or updated (the upsert does not say which); app consumers upsert either way.
      if (customerId) await recordCustomerChange(ctx.tx, ctx.storeId, customerId, 'updated')
      if (customerId && (co.marketing?.email || co.marketing?.whatsapp)) {
        await setMarketingConsents(
          ctx,
          customerId,
          {
            email: email && co.marketing.email ? true : undefined,
            whatsapp: co.marketing.whatsapp ? true : undefined,
          },
          { source: 'checkout', actor: { type: 'customer', id: customerId } },
        )
      }
    }
    // The store's settings are only read here: the number comes from `store_counter`, so the
    // checkout no longer holds the store row locked until it commits (0177).
    const [s] = await ctx.tx
      .select({
        payments: store.payments,
        address: store.address,
        gstRatePercent: store.gstRatePercent,
        apps: store.apps,
        preorder: store.preorder,
      })
      .from(store)
      .where(eq(store.id, ctx.storeId))
    if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
    const storePreorderNote = parsePreorderStoreSettings(s.preorder).note
    const storeTax = parseStoreTax(s.apps)
    const orderNumber = await takeOrderNumber(ctx.tx, ctx.storeId)
    const subtotalPaise = sumPaise(lines)
    // Discount first, then the payment-method fee or discount on what is left.
    // Both are applied server-side here; the checkout preview is only a hint.
    // A free-shipping discount zeroes the rate here (applyDiscount).
    const { discountPaise, shippingPaise, discountedSubtotalPaise } = applyDiscount(
      subtotalPaise,
      shipping?.pricePaise ?? 0,
      applied,
    )
    const adjustment = paymentAdjustmentFor(
      input.paymentProvider.id,
      parsePaymentSettings(s.payments).adjustments[input.paymentProvider.id],
      shipping,
    )
    const { adjustmentPaise, totalPaise: afterAdjustment } = applyPaymentAdjustment(
      discountedSubtotalPaise,
      adjustment,
    )
    const totalPaise = afterAdjustment + shippingPaise
    /* Listed prices include GST, so the tax is split out of the total rather
       than added to it; the shopper pays the same either way. Shipping is
       charged GST-inclusive too and is not a reduction: it lands in the
       "charges" part of the total, which follows the principal supply's rate
       (a composite supply), exactly like the COD fee. */
    /*
     * Each pre-order line's own deposit rule decides what is charged now vs.
     * later; everything else (shipping, non-pre-order items, tax) is charged
     * in full today. `full` mode pre-order lines defer nothing. Deposits are
     * computed against the line's list price (unit price * quantity),
     * ignoring the order-level discount split: PR2 (balance collection) can
     * refine this once it has to reconcile a partial refund against a
     * discounted deposit; for now the deposit is always a fraction of the
     * undiscounted line, which only ever *overstates* what is charged now.
     */
    const preorderLines = lines.filter((l) => l.preorder.enabled && !l.giftCard)
    const balanceDuePaise = preorderLines.reduce((sum, l) => {
      const { balancePaise } = computeDepositFromSettings(
        l.quantity * l.unitPricePaise,
        l.preorder,
        l.quantity,
      )
      return sum + balancePaise
    }, 0)
    const depositPaise = preorderLines.reduce((sum, l) => {
      const { depositPaise: dep } = computeDepositFromSettings(
        l.quantity * l.unitPricePaise,
        l.preorder,
        l.quantity,
      )
      return sum + dep
    }, 0)
    const tags = preorderLines.length > 0 ? ['pre-order'] : []
    const storeAddress = StoreAddressSchema.safeParse(s.address ?? {})
    // The GSTIN of the location the goods ship from decides CGST + SGST or IGST (tax/origin.ts).
    const grossOf = (key: string, quantity: number) =>
      quantity * (lines[Number(key)]?.unitPricePaise ?? 0)
    const storeState = storeAddress.success ? storeAddress.data.state : null
    const shipToState = input.checkout?.address.stateCode ?? null
    // Each parcel splits its own GST from its GSTIN; the order's is their sum (parcel-tax.ts).
    const billed = await taxParcels(ctx.tx, {
      parcels,
      lineOf: (key, quantity) => {
        const line = lines[Number(key)]
        return {
          grossPaise: grossOf(key, quantity),
          ratePercent: line ? lineGstRate(line, s.gstRatePercent, storeTax) : 0,
        }
      },
      discountPaise,
      adjustmentPaise,
      shippingPaise,
      shipToState,
      storeState,
    })
    const origin = billed.origin
    const tax =
      billed.tax ??
      computeOrderGst({
        lines: lines.map((l) => ({
          grossPaise: l.quantity * l.unitPricePaise,
          ratePercent: lineGstRate(l, s.gstRatePercent, storeTax),
        })),
        totalPaise,
        reductionPaise: discountPaise + Math.max(0, -adjustmentPaise),
        shipToState,
        storeState: origin.stateCode,
      })
    const [o] = await ctx.tx
      .insert(order)
      .values({
        storeId: ctx.storeId,
        number: orderNumber,
        status: 'open',
        subtotalPaise,
        taxPaise: tax.taxPaise,
        taxBreakdown: tax,
        gstRegistrationId: origin.gstRegistrationId,
        taxOrigin: origin,
        shippingPaise,
        // A delivery option has no rate row: only a backup order points at its zone rate.
        // A rate joined from several profiles keeps its first part here; the snapshot has all.
        shippingRateId: delivery
          ? backupRateId && primaryRateId(backupRateId)
          : shipping
            ? primaryRateId(shipping.rateId)
            : null,
        shippingRateName: shipping?.name ?? null,
        shipping: shipping
          ? {
              rateId: shipping.rateId,
              rateName: shipping.name,
              zoneId: shipping.zoneId,
              zoneName: shipping.zoneName,
              listPricePaise: shipping.listPricePaise,
              pricePaise: shippingPaise,
              codSurchargePaise: shipping.codSurchargePaise,
              minTransitDays: shipping.minTransitDays,
              maxTransitDays: shipping.maxTransitDays,
              ...(shipping.parts && !delivery
                ? {
                    profiles: shipping.parts.map((p) => ({
                      profileId: p.profileId,
                      profileName: p.profileName,
                      rateId: p.rateId,
                      rateName: p.name,
                      zoneId: p.zoneId,
                      zoneName: p.zoneName,
                      pricePaise: p.pricePaise,
                    })),
                  }
                : {}),
              ...(delivery ? { delivery } : {}),
            }
          : null,
        paymentAdjustmentPaise: adjustmentPaise,
        paymentAdjustmentLabel: adjustmentPaise ? (adjustment?.label ?? null) : null,
        discountId: applied?.discount.id ?? null,
        discountCode: applied?.discount.code ?? null,
        discountLabel: applied ? applied.label : null,
        discountPaise,
        totalPaise,
        customerId,
        shippingAddressId,
        // As typed (the customer row is keyed on the lower-cased one); null when optional and blank.
        email: input.checkout?.email.trim() || null,
        phone: contact?.phone ?? input.checkout?.phone ?? null,
        buyerGstin: contact?.gstin ?? null,
        buyerBusinessName: contact?.businessName ?? null,
        customerNote: contact?.note ?? null,
        paymentMethod: input.paymentProvider.id,
        // The gateway runs on its test keys: no real money, kept out of reports and invoices.
        isTest: input.paymentProvider.mode === 'test',
        attribution: cartAttribution,
        tracking: cartTracking,
        cartId: input.cartId,
        tags: risk ? tagsForRisk(tags, risk.risk, risk.settings) : tags,
        rtoRisk: risk?.risk ?? null,
        depositPaise: preorderLines.length > 0 ? depositPaise : null,
        balanceDuePaise: preorderLines.length > 0 ? balanceDuePaise : null,
      })
      .returning({ id: order.id })
    if (!o) throw new Error('order insert returned nothing')
    // In the same transaction as the insert: if a later step throws, the
    // workflow's compensation (below) deletes the order and the whole
    // transaction rolls back, taking this row with it.
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.placed', { orderId: o.id })
    if (risk?.verify) await requestCodConfirmation(ctx, o.id)
    const lineIds = lines.map(() => newId())
    await ctx.tx.insert(orderLine).values(
      lines.map((l, i) => ({
        id: lineIds[i],
        storeId: ctx.storeId,
        orderId: o.id,
        variantId: l.variantId,
        title: l.title,
        variantTitle: l.variantTitle,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        gstRatePercent: lineGstRate(l, s.gstRatePercent, storeTax),
        hsCode: l.giftCard ? null : l.hsCode,
        giftCard: l.giftCard,
        preorder: l.preorder.enabled && !l.giftCard,
        // What the unit cost the store as it sold: profit never reads today's cost.
        costAtSalePaise: l.giftCard ? null : l.costPaise,
        preorderShipDate:
          l.preorder.enabled && !l.giftCard ? resolveShipDate(l.preorder, new Date()) : null,
        // The note the shopper agreed to, kept as it read at the sale for the email and order pages.
        preorderNote:
          l.preorder.enabled && !l.giftCard
            ? preorderNoteText({
                productNote: l.preorderNote,
                storeNote: storePreorderNote,
                shipDate: resolveShipDate(l.preorder, new Date()),
              })
            : null,
      })),
    )
    // The parcels routing chose, where reserveStock holds their stock.
    await createFulfillmentOrders(ctx, {
      orderId: o.id,
      plans: parcels.map((p, i) => ({
        locationId: p.locationId,
        status: p.status,
        needsTransfer: p.needsTransfer,
        money: billed.money[i],
        deliveryEstimate: input.deliveryEstimates?.[p.locationId] ?? null,
        lines: p.lines.map((l) => ({
          orderLineId: lineIds[Number(l.key)] as string,
          quantity: l.quantity,
          fulfilledQuantity: 0,
        })),
      })),
      fallbackRegistrationId: origin.gstRegistrationId,
    })
    if (applied) {
      const email = (contact ? contact.email : input.checkout?.email.trim().toLowerCase()) || null
      await recordDiscountUses(ctx, applied, { id: o.id, customerId, email, discountPaise })
    }
    return { orderId: o.id, orderNumber, totalPaise, balanceDuePaise, depositPaise }
  },
  async compensate({ ctx, orderId, discount: applied }) {
    if (!orderId) return
    if (applied) await releaseDiscountUses(ctx, applied, orderId)
    await deleteFulfillmentOrders(ctx.tx, orderId)
    await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
    await ctx.tx.delete(order).where(eq(order.id, orderId))
  },
}

/**
 * A checkout without an email (Settings → Checkout made it optional) cannot use
 * the email key, so the shopper is matched on their mobile number: the blind
 * index when phones are encrypted, the plain number otherwise.
 */
async function upsertCustomerByPhone(
  ctx: StoreContext,
  values: {
    phone: string
    phoneIndex: string | null
    name: string
    defaultAddress: typeof customer.$inferInsert.defaultAddress
  },
): Promise<{ id: string }[]> {
  const [found] = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(
      values.phoneIndex
        ? eq(customer.phoneIndex, values.phoneIndex)
        : and(isNull(customer.phoneIndex), eq(customer.phone, values.phone)),
    )
    .orderBy(desc(customer.updatedAt))
    .limit(1)
  if (found) {
    await ctx.tx
      .update(customer)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(customer.id, found.id))
    return [found]
  }
  return ctx.tx
    .insert(customer)
    .values({ storeId: ctx.storeId, email: null, ...values })
    .returning({ id: customer.id })
}

/**
 * GST at the line's rate; a gift card sale is a voucher, taxed only when it is
 * redeemed. A composition-scheme store charges no GST on anything.
 */
const lineGstRate = (l: Line, storeRate: number, tax: StoreTaxSettings): number =>
  l.giftCard || !l.taxable ? 0 : chargedGstRate(l.gstRatePercent ?? storeRate, tax)

/**
 * Spend the applied gift cards against the total. Runs after the order exists
 * (payments reference it) and before the provider is charged, so the provider
 * only ever sees the remainder. COD cannot collect a remainder: a card spent on
 * a parcel that is then refused would sit locked until someone refunded it.
 */
const redeemCards: WorkflowStep<State> = {
  name: 'redeemGiftCards',
  async run({ ctx, input, orderId, totalPaise }) {
    const ids = input.giftCardIds ?? []
    if (!orderId || ids.length === 0) return {}
    const { redeemedPaise, redemptions } = await redeemGiftCards(ctx, {
      orderId,
      giftCardIds: ids,
      amountDuePaise: totalPaise,
    })
    if (redeemedPaise < totalPaise && input.paymentProvider.id === 'cod') {
      await reverseGiftCardRedemptions(ctx, redemptions)
      throw new GiftCardError(
        'not_allowed',
        'Cash on delivery cannot be used with a gift card. Pay the rest online.',
        ctx.storeId,
      )
    }
    return { giftCardPaise: redeemedPaise, redemptions }
  },
  async compensate({ ctx, redemptions }) {
    await reverseGiftCardRedemptions(ctx, redemptions)
  },
}

/** True when gift cards paid the whole order and no provider is involved. */
/** What must be collected today: the order total less whatever a deposit-mode pre-order defers. */
const chargeNowPaise = (s: Pick<State, 'totalPaise' | 'balanceDuePaise'>): number =>
  s.totalPaise - s.balanceDuePaise

const paidByCards = (s: Pick<State, 'giftCardPaise' | 'totalPaise' | 'balanceDuePaise'>): boolean =>
  s.giftCardPaise > 0 && s.giftCardPaise >= chargeNowPaise(s)

/**
 * Record the payment attempt, or settle the order when gift cards paid it all.
 * The gateway is not called here: this runs inside the transaction that holds
 * the stock reservations, so the call happens after commit
 * (`startPaymentAttempt`). Medusa orders its checkout steps the same way
 * (order first, payment last), and Saleor splits pre- and post-payment parts
 * of `complete_checkout` (patterns only: Medusa MIT, Saleor BSD-3).
 *
 * A deposit-mode pre-order only charges the deposit here (`chargeNowPaise`);
 * `order.balance_due_paise` carries what is left, and fulfilment refuses to
 * run while it is still owed (see `@commerce/core/order/fulfil`). Collecting
 * that balance is a later PR — this just charges the deposit and marks the
 * order paid-with-a-balance-due once the gateway captures it.
 */
const recordPaymentAttempt: WorkflowStep<State> = {
  name: 'recordPaymentAttempt',
  async run({ ctx, input, totalPaise, balanceDuePaise, giftCardPaise, orderId }) {
    if (!orderId) throw new Error('recordPaymentAttempt before createOrder')
    if (paidByCards({ giftCardPaise, totalPaise, balanceDuePaise })) {
      await ctx.tx
        .update(order)
        .set({ paymentMethod: GIFT_CARD_PROVIDER })
        .where(eq(order.id, orderId))
      // Paid entirely by gift cards: this never reaches applyPaymentStatus
      // (there is no gateway attempt), so the recompute here sees the captured
      // card payments and writes order.paid.
      await recomputeOrderStatuses(ctx, orderId)
      return {}
    }
    const attempt = await createPaymentAttempt(ctx, {
      orderId,
      provider: input.paymentProvider.id,
      amountPaise: chargeNowPaise({ totalPaise, balanceDuePaise }) - giftCardPaise,
    })
    // A part paid by gift card shows as partially paid until the gateway captures.
    await recomputeOrderStatuses(ctx, orderId)
    return { attemptId: attempt.id }
  },
}

const markCartConverted: WorkflowStep<State> = {
  name: 'markCartConverted',
  async run({ ctx, input }) {
    await ctx.tx.update(cart).set({ status: 'converted' }).where(eq(cart.id, input.cartId))
    return {}
  },
}

/**
 * Lock the cart row until the transaction ends, so two submits of one cart (a
 * double tap, a retry on a flaky connection) run one after the other. The
 * second then finds the cart converted and gets the first order back, with the
 * same payment session, instead of placing a duplicate. The unique
 * `(store_id, cart_id)` index on `order` is the backstop.
 *
 * Pattern from Saleor's `create_order_from_checkout` (BSD-3): `select_for_update`
 * on the checkout, and `Order.checkout_token` to find the order on replay.
 */
async function lockCartOrReplay(
  ctx: StoreContext,
  cartId: string,
): Promise<PlaceOrderResult | null> {
  const [c] = await ctx.tx
    .select({ status: cart.status })
    .from(cart)
    .where(eq(cart.id, cartId))
    .for('update')
  if (c?.status !== 'converted') return null
  const [o] = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      paymentMethod: order.paymentMethod,
      depositPaise: order.depositPaise,
      balanceDuePaise: order.balanceDuePaise,
    })
    .from(order)
    .where(eq(order.cartId, cartId))
  // Converted before orders recorded their cart: nothing to replay.
  if (!o) return null
  const [p] = await ctx.tx
    .select({
      id: payment.id,
      status: payment.status,
      checkoutSession: payment.checkoutSession,
    })
    .from(payment)
    .where(and(eq(payment.orderId, o.id), ne(payment.provider, GIFT_CARD_PROVIDER)))
    .orderBy(desc(payment.attempt), desc(payment.id))
    .limit(1)
  if (!p) {
    // Paid in full by gift cards: no provider payment was ever created.
    const providerRef = `gift_card_${o.id}`
    return {
      orderId: o.id,
      orderNumber: o.number,
      attemptId: null,
      paymentStatus: 'captured',
      session: { kind: 'none', provider: o.paymentMethod ?? GIFT_CARD_PROVIDER, providerRef },
      replayed: true,
      depositPaise: o.depositPaise ?? 0,
      balanceDuePaise: o.balanceDuePaise ?? 0,
    }
  }
  // Still `created` when the first submit died before reaching the gateway: the
  // caller starts it, and the attempt's claim keeps that to one gateway call.
  return {
    orderId: o.id,
    orderNumber: o.number,
    attemptId: p.id,
    paymentStatus: p.status,
    depositPaise: o.depositPaise ?? 0,
    balanceDuePaise: o.balanceDuePaise ?? 0,
    session: (p.checkoutSession as CheckoutSession | null) ?? null,
    replayed: true,
  }
}

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
 * Place an order from an open cart. Must run inside `withStore`; the caller's
 * transaction rolls back on throw. Reserves stock, creates the order and
 * records a `created` payment attempt, and never calls the gateway: start the
 * attempt after this transaction commits (`startPaymentAttempt`), or use
 * `placeOrderAndPay`, which does both.
 */
export async function placeOrder(
  ctx: StoreContext,
  input: PlaceOrderInput,
  log?: WorkflowLog,
): Promise<PlaceOrderResult> {
  const replay = await lockCartOrReplay(ctx, input.cartId)
  if (replay) return replay
  if (input.checkout) {
    // One spelling of the PIN code for every rule and for the stored address.
    const pincode = checkoutPincode(input.checkout.address.pincode)
    if (!pincode) {
      throw new CheckoutRuleViolation('contact', {
        storeId: ctx.storeId,
        fields: { pincode: 'Enter a valid 6-digit PIN code' },
      })
    }
    // The state picks the shipping zone and the GST split, so it must agree with the PIN.
    if (
      !stateMatchesPincode(pincode, input.checkout.address.stateCode, await directoryState(pincode))
    ) {
      throw new CheckoutRuleViolation('state_mismatch', {
        storeId: ctx.storeId,
        fields: { stateCode: 'The state does not match this PIN code' },
      })
    }
    input = {
      ...input,
      checkout: { ...input.checkout, address: { ...input.checkout.address, pincode } },
    }
  }
  const state = await runWorkflow<State>(
    {
      ctx,
      input,
      lines: [],
      cartDiscountCode: null,
      cartAttribution: null,
      cartTracking: null,
      discount: null,
      shipping: null,
      delivery: null,
      backupRateId: null,
      contact: null,
      parcels: [],
      reserved: [],
      orderId: null,
      orderNumber: null,
      totalPaise: 0,
      giftCardPaise: 0,
      redemptions: [],
      attemptId: null,
      depositPaise: 0,
      balanceDuePaise: 0,
      risk: null,
    },
    [
      loadCart,
      enforceLaunch,
      resolveDiscount,
      resolveShipping,
      enforceCheckoutRules,
      assessRisk,
      reserveStock,
      createOrder,
      redeemCards,
      recordPaymentAttempt,
      markCartConverted,
    ],
    log,
  )
  if (!state.orderId || state.orderNumber === null) {
    throw new Error('placeOrder finished without an order')
  }
  const byCards = !state.attemptId
  return {
    orderId: state.orderId,
    orderNumber: state.orderNumber,
    attemptId: state.attemptId,
    paymentStatus: byCards ? 'captured' : 'created',
    session: byCards
      ? { kind: 'none', provider: GIFT_CARD_PROVIDER, providerRef: `gift_card_${state.orderId}` }
      : null,
    replayed: false,
    depositPaise: state.depositPaise,
    balanceDuePaise: state.balanceDuePaise,
  }
}

export type PlacedAndPaid = PlaceOrderResult & {
  /** True when this call captured the money; drives the payment_received notification. */
  becameCaptured: boolean
  /** The gateway's error when the attempt could not be started; the order stays placed. */
  paymentError: string | null
}

/**
 * `placeOrder` in its own transaction, then the payment attempt started with
 * the gateway after commit. A gateway failure leaves the order placed with its
 * stock held and the attempt `failed`, ready for "Retry payment".
 */
export async function placeOrderAndPay(
  db: Db,
  storeId: string,
  input: PlaceOrderInput,
  log?: WorkflowLog,
): Promise<PlacedAndPaid> {
  const placed = await withStore(db, storeId, (tx) => placeOrder({ storeId, tx }, input, log))
  if (!placed.attemptId || placed.paymentStatus !== 'created') {
    const byCards = !placed.replayed && placed.paymentStatus === 'captured'
    return { ...placed, becameCaptured: byCards, paymentError: null }
  }
  const fallbacks = input.paymentFallbacks ?? []
  const started = fallbacks.length
    ? await startPaymentWithFallback(
        db,
        storeId,
        placed.attemptId,
        input.paymentProvider,
        fallbacks,
        { timeoutMs: GATEWAY_START_TIMEOUT_MS },
      )
    : await startPaymentAttempt(db, storeId, placed.attemptId, input.paymentProvider)
  return {
    ...placed,
    paymentStatus: started.status,
    session: started.session ?? placed.session,
    becameCaptured: started.becameCaptured,
    paymentError: started.error,
  }
}
