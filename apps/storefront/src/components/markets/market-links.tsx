'use client'

import { useEffect } from 'react'
import { marketHref } from '@/lib/liquid-market-links'

type MarketLinksProps = {
  /** The market's path prefix (`/ae`); nothing happens without one. */
  prefix: string
}

const LINKS = 'a[href^="/"], form[action^="/"]'

function fixOne(el: Element, prefix: string) {
  const attr = el.tagName === 'FORM' ? 'action' : 'href'
  const value = el.getAttribute(attr)
  if (!value) return
  const next = marketHref(value, prefix)
  if (next !== value) el.setAttribute(attr, next)
}

function fixAll(root: ParentNode, prefix: string) {
  if (root instanceof Element && root.matches(LINKS)) fixOne(root, prefix)
  for (const el of root.querySelectorAll(LINKS)) fixOne(el, prefix)
}

/** A same-site URL the page puts in the address bar, under the prefix. */
function marketUrl(url: string | URL | null | undefined, prefix: string) {
  if (url == null) return url
  const parsed = new URL(url, window.location.href)
  if (parsed.origin !== window.location.origin) return url
  return marketHref(`${parsed.pathname}${parsed.search}${parsed.hash}`, prefix)
}

/**
 * Keeps a subfolder market's shopper and its links in the market (`/ae`). Our own blocks, cart
 * and account pages write store paths (`/products/x`) and the filter panel writes the address
 * bar from them; Shopify keeps every one of them under the market's folder. After hydration
 * this moves each same-site link and form there, as it appears, and every address the page
 * pushes. The theme's own HTML is prefixed on the server (`lib/liquid-market-links.ts`).
 */
export default function MarketLinks({ prefix }: MarketLinksProps) {
  // Hooks
  useEffect(() => {
    if (!prefix) return
    fixAll(document, prefix)
    const observer = new MutationObserver((changes) => {
      for (const change of changes) {
        if (change.type === 'attributes') {
          if (change.target instanceof Element) fixOne(change.target, prefix)
          continue
        }
        for (const node of change.addedNodes) {
          if (node instanceof Element) fixAll(node, prefix)
        }
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['href', 'action'],
    })
    const push = history.pushState
    const replace = history.replaceState
    history.pushState = function (state, unused, url) {
      return push.call(this, state, unused, marketUrl(url, prefix))
    }
    history.replaceState = function (state, unused, url) {
      return replace.call(this, state, unused, marketUrl(url, prefix))
    }
    return () => {
      observer.disconnect()
      history.pushState = push
      history.replaceState = replace
    }
  }, [prefix])

  // Render logic
  return null
}
