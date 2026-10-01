'use client'

import { formatPaise } from '@commerce/blocks'
import type { CartView } from '@commerce/core'
import { formatSignedMoney } from '@commerce/money'
import type { ReactNode } from 'react'
import DiscountCodeField from '@/components/cart/discount-code-field'
import GiftCardField from '@/components/checkout/gift-card-field'
import { checkoutContent as content } from '@/data/checkout'
import type { CartDiscountView } from '@/lib/discount-actions'
import type { AppliedGiftCard } from '@/lib/gift-card-actions'

/** What the shipping row says: a price, "Free", or a prompt before the address is checked. */
export type ShippingRow =
  | { kind: 'price'; paise: number; name: string | null }
  | { kind: 'pending' }

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
  error: string | null
  /** Terms the shopper must see before paying, e.g. a non-refundable pre-order deposit. */
  notice?: string | null | undefined
  /** Under the notice: the minimum-order line and the links to the store's policies. */
  footnote?: ReactNode
  pending: boolean
  submitDisabled: boolean
  submitLabel: string
}

function shippingValue(row: ShippingRow): string {
  if (row.kind === 'pending') return content.shippingPending
  return row.paise === 0 ? content.shippingFree : formatPaise(row.paise)
}

/** The checkout's right column: lines, codes, the price rows and the submit button. */
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
  error,
  notice = null,
  footnote = null,
  pending,
  submitDisabled,
  submitLabel,
}: CheckoutSummaryProps) {
  // Render logic
  const discountPaise = discount?.amountPaise ?? 0
  const showSubtotal = adjustmentPaise !== 0 || discountPaise > 0 || shipping !== null

  return (
    <aside className="cart-layout__summary">
      <div className="cart-summary">
        <h2 className="cart-summary__heading h4">{content.summary}</h2>
        {cart.lines.map((l) => (
          <div key={l.id} className="cart-summary__row">
            <span>
              {l.productTitle} x {l.quantity}
            </span>
            <span>{formatPaise(l.linePaise)}</span>
          </div>
        ))}
        {digitalOnly ? null : <DiscountCodeField discount={discount} />}
        {digitalOnly ? null : (
          <GiftCardField
            applied={giftCards}
            onApply={onGiftCardApply}
            onRemove={onGiftCardRemove}
          />
        )}
        {showSubtotal ? (
          <div className="cart-summary__row">
            <span>{content.subtotal}</span>
            <span>{formatPaise(cart.subtotalPaise)}</span>
          </div>
        ) : null}
        {discount?.label && discountPaise > 0 ? (
          <div className="cart-summary__row cart-summary__row--discount">
            <span>{discount.label}</span>
            <span>−{formatPaise(discountPaise)}</span>
          </div>
        ) : null}
        {shipping ? (
          <div className="cart-summary__row">
            <span>
              {shipping.kind === 'price' && shipping.name
                ? `${content.shipping} (${shipping.name})`
                : content.shipping}
            </span>
            <span>{shippingValue(shipping)}</span>
          </div>
        ) : null}
        {adjustmentPaise !== 0 ? (
          <div className="cart-summary__row">
            <span>{adjustmentLabel}</span>
            <span>{formatSignedMoney(adjustmentPaise)}</span>
          </div>
        ) : null}
        <div className="cart-summary__row cart-summary__row--total">
          <span>{content.total}</span>
          <span>{formatPaise(totalPaise)}</span>
        </div>
        {cardRows.map((c) => (
          <div key={c.code} className="cart-summary__row cart-summary__row--discount">
            <span>{content.paidByGiftCard}</span>
            <span>−{formatPaise(c.amountPaise)}</span>
          </div>
        ))}
        {giftCards.length > 0 ? (
          <div className="cart-summary__row cart-summary__row--total">
            <span>{content.totalDue}</span>
            <span>{formatPaise(duePaise)}</span>
          </div>
        ) : null}
        {notice ? <p className="text-small">{notice}</p> : null}
        {footnote}
        {error ? (
          <p className="checkout__error text-small" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className={`btn btn--primary cart-summary__checkout${pending ? ' is-loading' : ''}`}
          disabled={submitDisabled}
        >
          <span className="btn__label">{submitLabel}</span>
        </button>
      </div>
    </aside>
  )
}
