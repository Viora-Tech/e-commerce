'use client'

import { formatPaise, useFormatCart, useFormatPaise, useMarketPricing } from '@commerce/blocks'
import type { CartView } from '@commerce/core'
import CheckoutDiscount from '@/components/checkout/checkout-discount'
import GiftCardField from '@/components/checkout/gift-card-field'
import SummaryItems from '@/components/checkout/summary-items'
import SummaryLine from '@/components/checkout/summary-line'
import SummaryRow from '@/components/checkout/summary-row'
import { type CheckoutCopy, checkoutContent as content } from '@/data/checkout'
import type { ShippingRow } from '@/lib/checkout-preview'
import type { CartDiscountView } from '@/lib/discount-view'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'

type CheckoutSummaryProps = {
  cart: CartView
  discount: CartDiscountView | null
  digitalOnly: boolean
  giftCards: AppliedGiftCard[]
  onGiftCardApply: (card: AppliedGiftCard) => void
  onGiftCardRemove: (code: string) => void
  /** Fee (+) or discount (−) of the chosen payment method; 0 hides the row. */
  adjustmentPaise: number
  adjustmentLabel: string
  shipping: ShippingRow | null
  totalPaise: number
  /** GST inside the total, once the server has worked it out; null shows "Inclusive of all taxes". */
  gstPaise?: number | null | undefined
  cardRows: (AppliedGiftCard & { amountPaise: number })[]
  duePaise: number
  /** A deposit pre-order's balance, charged later; 0 when nothing is deferred. */
  laterPaise: number
  /** What the shopper pays now: the big number at the top. */
  payNowPaise: number
  /** "EMI from ₹X/month", formatted, when the store offers EMI on this amount. */
  emiMonthly: string | null
  /** Terms the shopper must see before paying, e.g. a non-refundable pre-order deposit. */
  notice?: string | null | undefined
  /** Shipping is being re-quoted: amounts shimmer instead of showing a stale number. */
  updating: boolean
  /** The store's own wording for the heading and the taxes line (#158); ours when unset. */
  words?: Pick<CheckoutCopy, 'summary' | 'taxes'> | undefined
  /** Shipping abroad: no PIN code to ask for, and no Indian "inclusive of taxes" line (#64, #210). */
  abroad?: boolean
}

function shippingValue(
  row: ShippingRow,
  money: (paise: number) => string,
  abroad: boolean,
): string {
  if (row.kind === 'pending')
    return abroad ? content.shippingPendingAbroad : content.shippingPending
  return row.paise === 0 ? content.shippingFree : money(row.paise)
}

/**
 * The order summary card: every line with its thumbnail, codes, and the price rows down to
 * what is due today, on every step. Preview only; `placeOrder` prices the order.
 */
export default function CheckoutSummary({
  cart,
  discount,
  digitalOnly,
  giftCards,
  onGiftCardApply,
  onGiftCardRemove,
  adjustmentPaise,
  adjustmentLabel,
  shipping,
  totalPaise,
  gstPaise,
  cardRows,
  duePaise,
  laterPaise,
  payNowPaise,
  emiMonthly,
  notice = null,
  updating,
  words = content,
  abroad = false,
}: CheckoutSummaryProps) {
  // Hooks
  // On a market in another currency (`/ae`) the summary reads in it; Pay still charges rupees.
  const money = useFormatPaise()
  const cartMoney = useFormatCart()
  const pricing = useMarketPricing()

  // Helpers
  // Markets › Catalogs: lines with a fixed price read as on the product page, and the subtotal,
  // total and amount to pay move with them. The note below still names the rupees charged.
  const onCart = (paise: number) => cartMoney.cart(paise, cart.lines, cart.subtotalPaise)

  // Render logic
  const discountPaise = discount?.amountPaise ?? 0
  const itemCount = cart.lines.reduce((n, l) => n + l.quantity, 0)
  const shimmer = (
    <span
      aria-hidden="true"
      className="inline-block h-[0.8em] w-[4.5em] animate-pulse rounded bg-ck-summary-line align-middle motion-reduce:animate-none"
    />
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden items-center justify-between gap-4 lg:flex">
        <h2 className={'font-ck! text-[1.125rem]! leading-snug! font-bold! normal-case!'}>
          {words.summary}
        </h2>
        <p className="text-[0.8125rem] text-ck-faint">{content.itemCount(itemCount)}</p>
      </div>

      <section aria-label={words.summary} className="flex flex-col gap-4">
        <SummaryItems>
          {cart.lines.map((l) => (
            <SummaryLine
              key={l.id}
              title={l.productTitle}
              variant={l.variantTitle && l.variantTitle !== 'Default' ? l.variantTitle : null}
              quantity={l.quantity}
              linePaise={l.linePaise}
              imageUrl={l.imageUrl}
              preorder={l.preorder}
              preorderNote={l.preorderNote}
              format={money}
              price={cartMoney.line(l)}
            />
          ))}
        </SummaryItems>

        {digitalOnly ? null : (
          <div className="flex flex-col gap-2 border-t border-ck-summary-line pt-4">
            <CheckoutDiscount discount={discount} />
            <GiftCardField
              applied={giftCards}
              onApply={onGiftCardApply}
              onRemove={onGiftCardRemove}
            />
          </div>
        )}

        <dl className="flex flex-col gap-2.5 border-t border-ck-summary-line pt-4">
          <SummaryRow label={content.subtotal} value={onCart(cart.subtotalPaise)} />
          {discount?.label && discountPaise > 0 ? (
            <SummaryRow tone="saving" label={discount.label} value={`−${money(discountPaise)}`} />
          ) : null}
          {shipping ? (
            <SummaryRow
              label={
                shipping.kind === 'price' && shipping.name
                  ? `${content.shipping} · ${shipping.name}`
                  : content.shipping
              }
              value={updating ? shimmer : shippingValue(shipping, money, abroad)}
            />
          ) : null}
          {adjustmentPaise !== 0 ? (
            <SummaryRow
              label={adjustmentLabel}
              value={`${adjustmentPaise < 0 ? '−' : '+'}${money(Math.abs(adjustmentPaise))}`}
            />
          ) : null}
          <div className="mt-1.5! border-t border-ck-summary-line pt-4">
            <SummaryRow
              tone="total"
              label={
                <span className="flex flex-col gap-0.5">
                  <span className="flex items-baseline gap-1.5">
                    {content.total}
                    {pricing ? null : (
                      <span className="text-[0.75rem] font-normal text-ck-faint">
                        {content.totalCurrency}
                      </span>
                    )}
                  </span>
                  {gstPaise && gstPaise > 0 && !updating ? (
                    <span className="text-[0.8125rem] font-normal text-ck-faint">
                      {content.taxesIncluded(money(gstPaise))}
                    </span>
                  ) : abroad ? null : (
                    <span className="text-[0.8125rem] font-normal text-ck-faint">
                      {words.taxes}
                    </span>
                  )}
                </span>
              }
              value={
                <span
                  key={updating ? 'updating' : totalPaise}
                  aria-live="polite"
                  className="inline-block text-[1.75rem] leading-[2.125rem] font-bold tabular-nums transition-[opacity,translate] duration-200 ease-out starting:translate-y-0.5 starting:opacity-0 motion-reduce:starting:translate-y-0 lg:text-[1.5rem]"
                >
                  {updating ? shimmer : onCart(totalPaise)}
                </span>
              }
            />
          </div>
          {cardRows.map((c) => (
            <SummaryRow
              key={c.code}
              tone="saving"
              label={content.paidByGiftCard}
              value={`−${money(c.amountPaise)}`}
            />
          ))}
          {giftCards.length > 0 ? (
            <SummaryRow tone="total" label={content.totalDue} value={onCart(duePaise)} />
          ) : null}
          {laterPaise > 0 ? (
            <>
              <SummaryRow tone="total" label={content.dueToday} value={money(payNowPaise)} />
              <SummaryRow tone="muted" label={content.dueLater} value={money(laterPaise)} />
            </>
          ) : null}
        </dl>

        {pricing ? (
          <p className="rounded-ck bg-ck-summary-line p-3 text-[0.8125rem] text-ck-summary-muted">
            {content.chargedInRupees(formatPaise(payNowPaise), money(payNowPaise))}
          </p>
        ) : null}

        {emiMonthly || notice ? (
          <div className="flex flex-col gap-2 text-[0.8125rem] text-ck-summary-muted">
            {emiMonthly ? <p>{content.emi(emiMonthly)}</p> : null}
            {notice ? <p>{notice}</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
