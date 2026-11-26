'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  cartSignature,
  findCartAnchors,
  findProductAnchor,
  productPricePaise,
} from './loyalty-anchors'
import LoyaltyCartBox from './loyalty-cart-box'
import { forgetLoyaltyView, loadLoyaltyView } from './loyalty-client'
import { earnInfoOf, earnPreview, pointsWorthPaise } from './loyalty-math'
import LoyaltyProductLine from './loyalty-product-line'
import type { LoyaltyView } from './loyalty-types'

type LoyaltyPlacementsProps = {
  productLine: boolean
  cartBox: boolean
  pointsValue: boolean
  /** The widget's colour variables, so the boxes match the panel. */
  vars: Record<string, string>
}

type Spot = { key: string; host: HTMLElement; kind: 'product' | 'cart'; pricePaise: number | null }

const HOST_ATTR = 'data-kl-host'

/** A host just above `anchor`, made once; the theme re-rendering its drawer drops it, and the next scan puts it back. */
function hostBefore(anchor: Element, key: string): HTMLElement {
  const prev = anchor.previousElementSibling
  if (prev instanceof HTMLElement && prev.getAttribute(HOST_ATTR) === key) return prev
  const host = document.createElement('div')
  host.setAttribute(HOST_ATTR, key)
  host.className = 'kl-loyalty'
  anchor.parentNode?.insertBefore(host, anchor)
  return host
}

/** The spots on the page now; an app block placed by hand (custom position) wins over injection. */
function scan(opts: { productLine: boolean; cartBox: boolean }): Spot[] {
  const spots: Spot[] = []
  if (opts.productLine && !document.querySelector('[data-kl-product-block]')) {
    const anchor = findProductAnchor(document, window.location.pathname)
    if (anchor) {
      spots.push({
        key: 'product',
        host: hostBefore(anchor, 'product'),
        kind: 'product',
        pricePaise: productPricePaise(anchor, document),
      })
    }
  }
  if (opts.cartBox && !document.querySelector('[data-kl-cart-block]')) {
    findCartAnchors(document).forEach((anchor, i) => {
      const key = `cart-${i}`
      spots.push({ key, host: hostBefore(anchor, key), kind: 'cart', pricePaise: null })
    })
  }
  return spots
}

const sameSpots = (a: Spot[], b: Spot[]) =>
  a.length === b.length &&
  a.every((s, i) => s.host === b[i]?.host && s.pricePaise === b[i]?.pricePaise)

/**
 * The Loyalty widget's automatic placements, Essential Loyalty's way (no theme edit): the
 * points line above the product page's buy buttons, and the points box above every Checkout
 * button (cart page and cart drawer). It watches the page, so a drawer that opens or re-renders,
 * a variant that changes the price or a cart change is followed; one shared read of the
 * shopper's view (with the cart when there is a Checkout button) feeds both.
 */
export default function LoyaltyPlacements({
  productLine,
  cartBox,
  pointsValue,
  vars,
}: LoyaltyPlacementsProps) {
  // Hooks
  const [spots, setSpots] = useState<Spot[]>([])
  const [view, setView] = useState<LoyaltyView | null>(null)
  useEffect(() => {
    let stopped = false
    let timer = 0
    let signature = ''
    // null until the first read; then whether that read carried the cart.
    let readCart: boolean | null = null
    const refresh = () => {
      const found = scan({ productLine, cartBox })
      setSpots((old) => (sameSpots(old, found) ? old : found))
      if (found.length === 0) return
      const carts = found.filter((s) => s.kind === 'cart').map((s) => s.host)
      const next = cartSignature(carts.map((h) => h.nextElementSibling ?? h))
      const changed = next !== signature
      signature = next
      const needCart = carts.length > 0
      // Read once; again only when a cart appears or what it shows changes.
      if (readCart !== null && !(needCart && (changed || !readCart))) return
      if (readCart !== null) forgetLoyaltyView()
      readCart = needCart
      void loadLoyaltyView({ cart: needCart }).then((v) => {
        if (!stopped) setView(v)
      })
    }
    const later = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refresh, 250)
    }
    refresh()
    const observer = new MutationObserver(later)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    // A quantity box or variant picker changes a value without touching the DOM tree.
    document.addEventListener('change', later)
    document.addEventListener('click', later)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      observer.disconnect()
      document.removeEventListener('change', later)
      document.removeEventListener('click', later)
    }
  }, [productLine, cartBox])

  // Early returns
  if (!view?.live || spots.length === 0) return null
  if (view.signedIn && !view.member) return null

  // Render logic
  const earn = earnInfoOf(view)
  const style = vars as CSSProperties
  return (
    <>
      {spots.map((s) => {
        if (s.kind === 'cart') {
          return createPortal(
            <div style={style}>
              <LoyaltyCartBox view={view} showWorth={pointsValue} />
            </div>,
            s.host,
            s.key,
          )
        }
        const points = s.pricePaise ? earnPreview(s.pricePaise, earn) : 0
        if (points <= 0) return null
        return createPortal(
          <div style={style} className="py-3">
            <LoyaltyProductLine
              points={points}
              names={view.pointsName}
              balance={view.member ? view.member.points : null}
              worthPaise={pointsValue ? pointsWorthPaise(points, view) : null}
            />
          </div>,
          s.host,
          s.key,
        )
      })}
    </>
  )
}
