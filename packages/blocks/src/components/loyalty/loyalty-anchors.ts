/** SOURCE OF TRUTH: where the Loyalty widget puts its product line and cart box — WHAT: finds the product page's buy buttons and every Checkout button (cart page and cart drawer, ours or an imported theme's), the price and quantity the line counts from, and a cart's change signature / WHY: Essential Loyalty injects "above Buy now" and "above the checkout button" with no theme edit; the placement code and its tests share these rules */

import { priceFromText } from './loyalty-math'

/** A theme marks its own spot with `data-loyalty-anchor="product"` or `"cart"`; these win. */
const PRODUCT_ANCHORS = [
  '[data-loyalty-anchor="product"]',
  '.buy-buttons',
  'product-form',
  '.product-form__buttons',
  'form[action*="/cart/add"]',
]

const CHECKOUT_BUTTONS = [
  '[data-loyalty-anchor="cart"]',
  'button[name="checkout"]',
  'input[name="checkout"]',
  'a[href="/checkout"]',
  'a[href^="/checkout/start"]',
  '.cart-summary__checkout',
]

/** The row a Checkout button sits in (the box goes above the whole row, not beside it). */
const CHECKOUT_ROWS =
  '.cart-drawer__actions, .cart__ctas, .cart__checkout-wrapper, .cart-summary__actions'

/** Never inside the widget itself or a sticky bar. */
const SKIP = '.kl-loyalty, .sticky-atc, [data-kl-skip]'

const PRICES =
  '[data-loyalty-price], .price__current, .price-item--sale, .price-item--regular, [data-product-price], .product__price, .price'

/** The quantity box next to the buy button (named, or a theme's quantity field). */
const QUANTITY =
  'input[name="quantity"], .quantity-input__field, quantity-input input, input[aria-label="Quantity" i]'

/** A dialog only counts when it is the cart drawer (not a pay sheet or a quick view). */
const usable = (el: Element) =>
  !el.closest(SKIP) && !(el.closest('dialog') && !el.closest('[class*="cart"], cart-drawer'))

/** The product page's buy area to put the points line above, or null off a product page. */
export function findProductAnchor(root: ParentNode, path: string): Element | null {
  if (!/\/products\//.test(path)) return null
  for (const sel of PRODUCT_ANCHORS) {
    const hit = [...root.querySelectorAll(sel)].find(usable)
    if (hit) return hit
  }
  return null
}

/** Every spot for the cart box: above each Checkout row (the drawer's and the cart page's). */
export function findCartAnchors(root: ParentNode): Element[] {
  const out: Element[] = []
  for (const sel of CHECKOUT_BUTTONS) {
    for (const el of root.querySelectorAll(sel)) {
      if (!usable(el)) continue
      const row = el.matches('[data-loyalty-anchor]') ? el : (el.closest(CHECKOUT_ROWS) ?? el)
      if (!out.includes(row) && !out.some((o) => o.contains(row) || row.contains(o))) out.push(row)
    }
  }
  return out
}

/** The container a product's price and quantity live in, around the buy area. */
function productScope(anchor: Element): Element {
  return (
    anchor.closest(
      '[data-product-info], .product-info, .product-layout__info, .product__info-wrapper, .product, main',
    ) ??
    anchor.parentElement ??
    anchor
  )
}

/** Lowest offer price in the page's schema.org data (our storefront always prints it). */
function schemaPrice(root: ParentNode): number | null {
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    const prices = (s.textContent ?? '').match(/"price"\s*:\s*"?(\d+(?:\.\d+)?)/g) ?? []
    const values = prices
      .map((m) => Number.parseFloat(m.replace(/[^\d.]/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (values.length > 0) return Math.round(Math.min(...values) * 100)
  }
  return null
}

/**
 * The price the line counts from, in paise, times the quantity box: the price shown in the buy
 * area (it follows the chosen variant), else the page's schema.org offer. Null when none.
 */
export function productPricePaise(anchor: Element, root: ParentNode): number | null {
  const scope = productScope(anchor)
  const el = [...scope.querySelectorAll(PRICES)].find(usable)
  const own = el?.getAttribute('data-loyalty-price')
  const unit = own ? Number(own) : (priceFromText(el?.textContent) ?? schemaPrice(root))
  if (!unit || !Number.isFinite(unit) || unit <= 0) return null
  const qtyInput = scope.querySelector(QUANTITY)
  const qty = Number((qtyInput as HTMLInputElement | null)?.value ?? 1)
  return unit * (Number.isInteger(qty) && qty > 0 && qty < 1000 ? qty : 1)
}

/** A short signature of what the cart rows show, so a change (add, remove, quantity) refetches. */
export function cartSignature(anchors: readonly Element[]): string {
  return anchors
    .map((a) => {
      const box = a.closest('form, .cart-drawer, .cart, main') ?? a.parentElement
      // The widget's own box sits inside the cart form: its text must not count.
      let raw = box?.textContent ?? ''
      for (const own of box?.querySelectorAll('.kl-loyalty') ?? []) {
        raw = raw.replace(own.textContent ?? '', '')
      }
      const text = raw.replace(/\s+/g, ' ')
      let h = 0
      for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0
      return `${text.length}:${h}`
    })
    .join('|')
}
