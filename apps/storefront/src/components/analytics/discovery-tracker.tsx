'use client'

import { productHandleFromHref } from '@commerce/core/marketing'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { sendDiscoveryEvent } from '@/lib/discovery-beacon'

type RowIntent = 'related' | 'complementary'

/** The search results page (on a market's language prefix too). */
const SEARCH_PATH = /(?:^|\/)search\/?$/

/** Recommendation rows: our own section's marker, and an imported Shopify theme's element. */
const ROW_SELECTOR = '[data-recommendations], product-recommendations, .product-recommendations'

/** How long after a page opens a theme's row may still arrive (it is fetched after load). */
const WATCH_MS = 15_000

/** Share of a row that must be on screen to count as seen. */
const SEEN_THRESHOLD = 0.3

/** Which recommendation row an element is: our marker's value, or the theme's intent. */
function rowIntent(row: Element): RowIntent {
  const own = row.getAttribute('data-recommendations')
  if (own === 'complementary' || own === 'related') return own
  const intent = row.getAttribute('data-intent') ?? ''
  return intent === 'complementary' || row.className.toString().includes('complementary')
    ? 'complementary'
    : 'related'
}

/** A product link inside the page's own origin, as its handle. */
function linkHandle(a: HTMLAnchorElement): string | null {
  if (a.origin !== window.location.origin) return null
  return productHandleFromHref(a.href)
}

/** The search's words from the address bar, for a click on a result. */
function currentQuery(): string {
  return new URLSearchParams(window.location.search).get('q') ?? ''
}

/** A click on a product link: from a recommendation row, from the search results, or neither. */
function handleDocumentClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target : null
  const a = target?.closest('a[href]')
  if (!(a instanceof HTMLAnchorElement)) return
  const handle = linkHandle(a)
  if (!handle) return
  const row = a.closest(ROW_SELECTOR)
  if (row) {
    sendDiscoveryEvent({ kind: 'click', source: rowIntent(row), handle })
    return
  }
  // The header's predictive search is not the results page.
  if (!SEARCH_PATH.test(window.location.pathname) || a.closest('header, predictive-search')) return
  sendDiscoveryEvent({ kind: 'click', source: 'search', handle, query: currentQuery() })
}

/**
 * Search & discovery events the page itself cannot send: clicks on search results and on
 * recommendation rows, and a recommendation row seen on a product page (once per row per page).
 * Mounted only after a yes to analytics, beside the page-view beacon; listens passively and
 * sends beacons, so nothing waits on it.
 */
export default function DiscoveryTracker() {
  // Hooks
  const pathname = usePathname()

  useEffect(() => {
    document.addEventListener('click', handleDocumentClick, { capture: true, passive: true })
    return () => document.removeEventListener('click', handleDocumentClick, { capture: true })
  }, [])

  // Rows are looked for again on every product page; the path is the trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every route change
  useEffect(() => {
    const handle = productHandleFromHref(window.location.href)
    if (!handle || typeof IntersectionObserver === 'undefined') return
    const counted = new WeakSet<Element>()
    const watched = new WeakSet<Element>()
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target
          if (!entry.isIntersecting || counted.has(row)) continue
          if (!row.querySelector('a[href*="/products/"]')) continue
          counted.add(row)
          seen.unobserve(row)
          sendDiscoveryEvent({ kind: 'impression', source: rowIntent(row), handle })
        }
      },
      { threshold: SEEN_THRESHOLD },
    )
    const watch = () => {
      for (const row of document.querySelectorAll(ROW_SELECTOR)) {
        if (watched.has(row)) continue
        watched.add(row)
        seen.observe(row)
      }
    }
    watch()
    const added = new MutationObserver(watch)
    added.observe(document.body, { childList: true, subtree: true })
    const stop = window.setTimeout(() => added.disconnect(), WATCH_MS)
    return () => {
      window.clearTimeout(stop)
      added.disconnect()
      seen.disconnect()
    }
  }, [pathname])

  // Render logic
  return null
}
