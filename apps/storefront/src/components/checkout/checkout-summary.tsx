'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartView } from '@commerce/core'
import { formatSignedMoney } from '@commerce/money'
import CheckoutDiscount from '@/components/checkout/checkout-discount'
import GiftCardField from '@/components/checkout/gift-card-field'
import SummaryLine from '@/components/checkout/summary-line'
import SummaryRow from '@/components/checkout/summary-row'
import { checkoutContent as content } from '@/data/checkout'
import type { ShippingRow } from '@/lib/checkout-preview'
import type { CartDiscountView } from '@/lib/discount-actions'
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
}

function shippingValue(row: ShippingRow): string {
  if (row.kind === 'pending') return content.shippingPending
  return row.paise === 0 ? content.shippingFree : formatPaise(row.paise)
}

/**
 * The left column: the big amount, every line with its thumbnail, codes, and the price
 * rows down to what is due today. Preview only; `placeOrder` prices the order.
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
  cardRows,
  duePaise,
  laterPaise,
  payNowPaise,
  emiMonthly,
  notice = null,
  updating,
}: CheckoutSummaryProps) {
  // Render logic
  const discountPaise = discount?.amountPaise ?? 0
  const shimmer = (
    <span
      aria-hidden="true"
      className="inline-block h-[0.8em] w-[4.5em] animate-pulse rounded bg-ck-summary-line align-middle motion-reduce:animate-none"
    />
  )

  return (
    <div className="flex flex-col gap-7 lg:gap-9">
      <div className="hidden flex-col gap-1.5 lg:flex">
        <p className="text-[0.875rem] font-medium text-ck-summary-muted">{content.orderTotal}</p>
        <p
          className="text-[2.5rem] leading-none font-semibold tracking-[-0.025em] tabular-nums"
          aria-live="polite"
        >
          {updating ? shimmer : formatPaise(payNowPaise)}
        </p>
      </div>

      <section aria-label={content.summary} className="flex flex-col gap-7">
        <ul className="flex flex-col gap-5">
          {cart.lines.map((l) => (
            <SummaryLine
              key={l.id}
              title={l.productTitle}
              variant={l.variantTitle && l.variantTitle !== 'Default' ? l.variantTitle : null}
              quantity={l.quantity}
              linePaise={l.linePaise}
              imageUrl={l.imageUrl}
              preorder={l.preorder}
            />
          ))}
        </ul>

        {digitalOnly ? null : (
          <div className="flex flex-col gap-4 border-t border-ck-summary-line pt-6">
            <CheckoutDiscount discount={discount} />
            <GiftCardField
              applied={giftCards}
              onApply={onGiftCardApply}
              onRemove={onGiftCardRemove}
            />
          </div>
        )}

        <dl className="flex flex-col gap-3 border-t border-ck-summary-line pt-6">
          <SummaryRow label={content.subtotal} value={formatPaise(cart.subtotalPaise)} />
          {discount?.label && discountPaise > 0 ? (
            <SummaryRow
              tone="saving"
              label={discount.label}
              value={`−${formatPaise(discountPaise)}`}
            />
          ) : null}
          {shipping ? (
            <SummaryRow
              label={
                shipping.kind === 'price' && shipping.name
                  ? `${content.shipping} · ${shipping.name}`
                  : content.shipping
              }
              value={updating ? shimmer : shippingValue(shipping)}
            />
          ) : null}
          {adjustmentPaise !== 0 ? (
            <SummaryRow label={adjustmentLabel} value={formatSignedMoney(adjustmentPaise)} />
          ) : null}
          <div className="mt-2! border-t border-ck-summary-line pt-4">
            <SummaryRow
              tone="total"
              label={
                <span className="flex flex-col gap-0.5">
                  {content.total}
                  <span className="text-[0.75rem] font-normal text-ck-summary-muted">
                    {content.taxes}
                  </span>
                </span>
              }
              value={updating ? shimmer : formatPaise(totalPaise)}
            />
          </div>
          {cardRows.map((c) => (
            <SummaryRow
              key={c.code}
              tone="saving"
              label={content.paidByGiftCard}
              value={`−${formatPaise(c.amountPaise)}`}
            />
          ))}
          {giftCards.length > 0 ? (
            <SummaryRow tone="total" label={content.totalDue} value={formatPaise(duePaise)} />
          ) : null}
          {laterPaise > 0 ? (
            <>
              <SummaryRow tone="total" label={content.dueToday} value={formatPaise(payNowPaise)} />
              <SummaryRow tone="muted" label={content.dueLater} value={formatPaise(laterPaise)} />
            </>
          ) : null}
        </dl>

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
