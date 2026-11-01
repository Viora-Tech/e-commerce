import { EmptyState, Icon, Money } from '@commerce/blocks'
import { getCart } from '@commerce/core'
import { isAbroad } from '@commerce/core/checkout-address'
import { headers } from 'next/headers'
import CartCheckoutLink from '@/components/cart/cart-checkout-link'
import DiscountCodeField from '@/components/cart/discount-code-field'
import FreeShippingProgress from '@/components/cart/free-shipping-progress'
import { cartContent as content } from '@/data/cart'
import { readCartId } from '@/lib/cart-cookie'
import { cartDiscountView } from '@/lib/discount-view'
import { MARKET_HEADERS, marketPath } from '@/lib/markets'
import { cartShippingHint } from '@/lib/shipping'
import { inStore } from '@/lib/store-context'
import CartLines from './cart-lines'

type CartContentsProps = {
  storeId: string
  /** Items "Buy again" left out (sold out, hidden, not sold here), named above the lines. */
  reorderSkipped?: { titles: string[]; more: number } | undefined
}

/** The shipping row before there is an address: free, free from here, or worked out at checkout. */
function shippingLabel(charged: boolean, freeNow: boolean): string {
  return !charged || freeNow ? content.shippingFree : content.shippingAtCheckout
}

/** The cart template's main section: lines, discount code and summary. */
export default async function CartContents({ storeId, reorderSkipped }: CartContentsProps) {
  // Hooks
  const cartId = await readCartId()
  const cart = cartId ? await inStore(storeId, (tx) => getCart({ storeId, tx }, cartId)) : null
  const lines = cart?.status === 'open' ? cart.lines : []
  const requestHeaders = await headers()
  // Back to the shop inside the shopper's market (`/ae/collections`), not the default one.
  const collectionsHref = marketPath(
    requestHeaders.get(MARKET_HEADERS.prefix) ?? '',
    '/collections',
  )

  // Early returns
  if (!cart || lines.length === 0) {
    return (
      <section className="section-cart page-width">
        <h1 className="cart-page__title">{content.title}</h1>
        <EmptyState
          icon="bag"
          title={content.empty.heading}
          body={content.empty.body}
          action={{ label: content.empty.cta, href: collectionsHref }}
        />
      </section>
    )
  }

  // Render logic
  const discount = await cartDiscountView(cart.id, cart.discountCode)
  const discountPaise = discount?.amountPaise ?? 0
  const total = Math.max(0, cart.subtotalPaise - discountPaise)
  const india = await inStore(storeId, (tx) => cartShippingHint(tx, cart.id))
  // The hint is India's rates; a market abroad ships on its own zone's rates, priced at checkout.
  const abroad = isAbroad(requestHeaders.get(MARKET_HEADERS.country) ?? 'IN')
  const hint = abroad ? { charged: true, freeAbovePaise: null } : india
  const threshold = discount?.freeShipping ? null : hint.freeAbovePaise
  const freeNow = discount?.freeShipping === true || (threshold !== null && total >= threshold)
  // Subtotal and total agree with the lines' fixed catalog prices in a market (Markets › Catalogs).
  const priced = {
    lines: lines.map((l) => ({
      variantId: l.variantId,
      unitPricePaise: l.unitPricePaise,
      quantity: l.quantity,
      linePaise: l.linePaise,
    })),
    subtotalPaise: cart.subtotalPaise,
  }

  return (
    <section className="section-cart page-width">
      <h1 className="cart-page__title">
        {content.title}
        <span className="cart-page__count">
          {content.itemCount(lines.reduce((n, l) => n + l.quantity, 0))}
        </span>
      </h1>
      {reorderSkipped && reorderSkipped.titles.length > 0 ? (
        <div
          role="status"
          className="mb-6 flex flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4"
        >
          <p className="text-body">{content.reorderSkipped.heading}</p>
          <ul className="list-disc pl-5 text-small text-muted">
            {reorderSkipped.titles.map((title) => (
              <li key={title}>{title}</li>
            ))}
            {reorderSkipped.more > 0 ? (
              <li>{content.reorderSkipped.more(reorderSkipped.more)}</li>
            ) : null}
          </ul>
        </div>
      ) : null}
      <div className="cart-layout">
        <div className="cart-layout__lines">
          <CartLines lines={lines} />
          <a href={collectionsHref} className="cart-page__continue">
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
                <Money paise={cart.subtotalPaise} cart={priced} />
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
                <Money paise={total} cart={priced} />
              </span>
            </div>
            <p className="text-caption">
              {abroad ? content.taxesAtCheckoutAbroad : content.taxesAtCheckout}
            </p>
            <CartCheckoutLink className="btn btn--primary cart-summary__checkout">
              {content.checkout}
              <Icon name="arrow-right" size={16} />
            </CartCheckoutLink>
            <ul className="cart-summary__methods" aria-label={content.paymentMethods}>
              {(abroad ? content.paymentsAbroad : content.payments).map((p) => (
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
