// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  cartSignature,
  findCartAnchors,
  findProductAnchor,
  productPricePaise,
} from '../src/components/loyalty/loyalty-anchors'

const page = (html: string) => {
  document.body.innerHTML = html
  return document
}

describe('product line anchor', () => {
  const html = `
    <main>
      <div class="product-layout__info">
        <div class="product-info__price"><span class="price__current">₹2,199</span></div>
        <div class="buy-buttons">
          <div class="quantity-input"><input class="quantity-input__field" type="number" value="2"></div>
          <button>Add to cart</button>
        </div>
      </div>
      <aside class="sticky-atc"><form action="/cart/add"><button>Add</button></form></aside>
    </main>`

  it('finds the buy buttons on a product page only', () => {
    const doc = page(html)
    expect(findProductAnchor(doc, '/products/pad')?.className).toBe('buy-buttons')
    expect(findProductAnchor(doc, '/collections/all')).toBeNull()
  })

  it('counts the shown price times the quantity box', () => {
    const doc = page(html)
    const anchor = findProductAnchor(doc, '/products/pad')
    expect(anchor && productPricePaise(anchor, doc)).toBe(439_800)
  })

  it('falls back to the schema.org offer when no price shows', () => {
    const doc = page(`
      <script type="application/ld+json">{"offers":[{"price":"1299.00"},{"price":"999"}]}</script>
      <main><form action="/cart/add"><button>Add</button></form></main>`)
    const anchor = findProductAnchor(doc, '/products/x')
    expect(anchor && productPricePaise(anchor, doc)).toBe(99_900)
  })

  it('lets a theme mark its own spot', () => {
    const doc = page(
      '<div class="buy-buttons"></div><div data-loyalty-anchor="product" id="mine"></div>',
    )
    expect(findProductAnchor(doc, '/products/x')?.id).toBe('mine')
  })
})

describe('cart box anchors', () => {
  it('goes above the drawer row and the cart page button, never a pay sheet', () => {
    const doc = page(`
      <dialog class="cart-drawer"><form><div class="cart-drawer__actions">
        <a href="/cart">View cart</a><button name="checkout">Checkout</button>
      </div></form></dialog>
      <div class="cart-summary"><a class="cart-summary__checkout" href="/checkout/start">Check out</a></div>
      <dialog class="upi-sheet"><button name="checkout">Continue</button></dialog>`)
    const found = findCartAnchors(doc).map((a) => a.className)
    expect(found).toEqual(['cart-drawer__actions', 'cart-summary__checkout'])
  })

  it('changes its signature when the cart rows change, not when the box itself does', () => {
    const doc = page(`
      <form><div class="kl-loyalty">1,000 points</div><p>1 item ₹999</p>
      <div class="cart-drawer__actions"><button name="checkout">Checkout</button></div></form>`)
    const anchors = findCartAnchors(doc)
    const before = cartSignature(anchors)
    const box = doc.querySelector('.kl-loyalty')
    if (box) box.textContent = '1,000 points to redeem, expanded'
    expect(cartSignature(anchors)).toBe(before)
    const row = doc.querySelector('p')
    if (row) row.textContent = '2 items ₹1,998'
    expect(cartSignature(anchors)).not.toBe(before)
  })
})
