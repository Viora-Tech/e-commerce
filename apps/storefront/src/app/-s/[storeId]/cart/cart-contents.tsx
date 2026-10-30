import { EmptyState, Icon, Money } from '@commerce/blocks'
import { getCart } from '@commerce/core'
import CartCheckoutLink from '@/components/cart/cart-checkout-link'
import DiscountCodeField from '@/components/cart/discount-code-field'
import FreeShippingProgress from '@/components/cart/free-shipping-progress'
import { cartContent as content } from '@/data/cart'
import { readCartId } from '@/lib/cart-cookie'
import { cartDiscountView } from '@/lib/discount-view'
import { cartShippingHint } from '@/lib/shipping'
import { inStore } from '@/lib/store-context'
import CartLines from './cart-lines'

type CartContentsProps = { storeId: string }

/** The shipping row before there is an address: free, free from here, or worked out at checkout. */
function shippingLabel(charged: boolean, freeNow: boolean): string {
  return !charged || freeNow ? content.shippingFree : content.shippingAtCheckout
}

/** The cart template's main section: lines, discount code and summary. */
export default async function CartContents({ storeId }: CartContentsProps) {
  // Hooks
  const cartId = await readCartId()
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  const lines = cart?.status === 'open' ? cart.lines : []

  // Early returns
  if (!cart || lines.length === 0) {
    return (
      <section className="section-cart page-width">
        <h1 className="cart-page__title">{content.title}</h1>
        <EmptyState
          icon="bag"
          title={content.empty.heading}
          body={content.empty.body}
          action={{ label: content.empty.cta, href: '/collections' }}
        />
      </section>
    )
  }

  // Render logic
  const discount = await cartDiscountView(cart.id, cart.discountCode)
  const discountPaise = discount?.amountPaise ?? 0
  const total = Math.max(0, cart.subtotalPaise - discountPaise)
  const hint = await inStore(storeId, (tx) => cartShippingHint(tx, cart.id))
  const threshold = discount?.freeShipping ? null : hint.freeAbovePaise
  const freeNow = discount?.freeShipping === true || (threshold !== null && total >= threshold)

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title">
        {content.title}
        <span className="cart-page__count">
          {content.itemCount(lines.reduce((n, l) => n + l.quantity, 0))}
        </span>
      </h1>
      <div className="cart-layout">
        <div className="cart-layout__lines">
          <CartLines lines={lines} />
          <a href="/collections" className="cart-page__continue">
            <Icon name="arrow-right" size={16} />
            {content.continueShopping}
          </a>
        </div>
        <aside className="cart-layout__summary">
          <div className="cart-summary">
            <h2 className="cart-summary__heading">{content.summary}</h2>
            <DiscountCodeField discount={discount} />
            <div className="cart-summary__row">
              <span>{content.subtotal}</span>
              <span>
                <Money paise={cart.subtotalPaise} />
              </span>
            </div>
            {discount?.label && discountPaise > 0 ? (
              <div className="cart-summary__row cart-summary__row--discount">
                <span>{discount.label}</span>
                <span>
                  −<Money paise={discountPaise} />
                </span>
              </div>
            ) : null}
            <div className="cart-summary__row">
              <span>{content.shipping}</span>
              <span>{shippingLabel(hint.charged, freeNow)}</span>
            </div>
            {hint.charged && threshold !== null ? (
              <FreeShippingProgress thresholdPaise={threshold} totalPaise={total} />
            ) : null}
            <div className="cart-summary__row cart-summary__row--total">
              <span>{content.total}</span>
              <span>
                <Money paise={total} />
              </span>
            </div>
            <p className="text-caption">{content.taxesAtCheckout}</p>
            <CartCheckoutLink className="btn btn--primary cart-summary__checkout">
              {content.checkout}
              <Icon name="arrow-right" size={16} />
            </CartCheckoutLink>
            <ul className="cart-summary__methods" aria-label={content.paymentMethods}>
              {content.payments.map((p) => (
                <li key={p} className="cart-summary__method">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </section>
  )
}
