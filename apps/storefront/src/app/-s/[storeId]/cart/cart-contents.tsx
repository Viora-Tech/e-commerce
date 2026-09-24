import { formatPaise } from '@commerce/blocks'
import { getCart } from '@commerce/core'
import DiscountCodeField from '@/components/cart/discount-code-field'
import FreeShippingProgress from '@/components/cart/free-shipping-progress'
import { cartContent as content } from '@/data/cart'
import { readCartId } from '@/lib/cart-cookie'
import { cartDiscountView } from '@/lib/discount-actions'
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
        <div className="cart-empty">
          <h1 className="cart-empty__heading h2">{content.empty.heading}</h1>
          <p className="cart-empty__text text-body">{content.empty.body}</p>
          <a href="/" className="btn btn--secondary btn--pill cart-empty__cta">
            {content.empty.cta}
          </a>
        </div>
      </section>
    )
  }

  // Render logic
  const discount = await cartDiscountView(storeId, cart.id, cart.discountCode)
  const discountPaise = discount?.amountPaise ?? 0
  const total = Math.max(0, cart.subtotalPaise - discountPaise)
  const hint = await inStore(storeId, (tx) => cartShippingHint(tx))
  const threshold = discount?.freeShipping ? null : hint.freeAbovePaise
  const freeNow = discount?.freeShipping === true || (threshold !== null && total >= threshold)

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title h2">{content.title}</h1>
      <div className="cart-layout">
        <div className="cart-layout__lines">
          <CartLines storeId={storeId} lines={lines} />
        </div>
        <aside className="cart-layout__summary">
          <div className="cart-summary">
            <h2 className="cart-summary__heading h4">{content.summary}</h2>
            <DiscountCodeField storeId={storeId} discount={discount} />
            <div className="cart-summary__row">
              <span>{content.subtotal}</span>
              <span>{formatPaise(cart.subtotalPaise)}</span>
            </div>
            {discount?.label && discountPaise > 0 ? (
              <div className="cart-summary__row cart-summary__row--discount">
                <span>{discount.label}</span>
                <span>−{formatPaise(discountPaise)}</span>
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
              <span>{formatPaise(total)}</span>
            </div>
            <p className="text-caption">{content.taxes}</p>
            <a href="/checkout" className="btn btn--primary cart-summary__checkout">
              {content.checkout}
            </a>
          </div>
        </aside>
      </div>
    </section>
  )
}
