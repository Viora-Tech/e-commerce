import { formatPaise } from '@commerce/blocks'
import { getCart } from '@commerce/core'
import { readCartId } from '@/lib/cart-cookie'
import { inStore } from '@/lib/store-context'
import { CartLines } from './cart-lines'

type Params = { params: Promise<{ storeId: string }> }

export default async function CartPage({ params }: Params) {
  const { storeId } = await params
  const cartId = await readCartId()
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  const lines = cart?.status === 'open' ? cart.lines : []

  if (lines.length === 0) {
    return (
      <section className="section-cart page-width">
        <div className="cart-empty">
          <h1 className="cart-empty__heading h2">Your cart is empty</h1>
          <p className="cart-empty__text text-body">Find something worth gliding on.</p>
          <a href="/" className="btn btn--secondary btn--pill cart-empty__cta">
            Continue shopping
          </a>
        </div>
      </section>
    )
  }

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title h2">Your cart</h1>
      <div className="cart-layout">
        <div className="cart-layout__lines">
          <CartLines storeId={storeId} lines={lines} />
        </div>
        <aside className="cart-layout__summary">
          <div className="cart-summary">
            <h2 className="cart-summary__heading h4">Summary</h2>
            <div className="cart-summary__row">
              <span>Subtotal</span>
              <span>{formatPaise(cart?.subtotalPaise ?? 0)}</span>
            </div>
            <div className="cart-summary__row">
              <span>Shipping</span>
              <span>Free</span>
            </div>
            <div className="cart-summary__row cart-summary__row--total">
              <span>Total</span>
              <span>{formatPaise(cart?.subtotalPaise ?? 0)}</span>
            </div>
            <p className="text-caption">Inclusive of all taxes.</p>
            <a href="/checkout" className="btn btn--primary cart-summary__checkout">
              Check out
            </a>
          </div>
        </aside>
      </div>
    </section>
  )
}
