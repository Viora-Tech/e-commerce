import { CART_ADDED_EVENT, trackCommerce } from '@commerce/blocks'
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import BuyBox from './buy-box'
import { islandContainer } from './container'
import { ISLAND_PROPS_ID, type IslandProps, parseIslandProps } from './props'

/**
 * The buy box island's browser entry (bundled by `../../scripts/build-island.ts`): reads the
 * props the server wrote, finds our section's element in `<main>` and hydrates the same tree the
 * server rendered (`./buy-box.tsx`). Nothing else on the page is React.
 */

function start(): void {
  const json = document.getElementById(ISLAND_PROPS_ID)?.textContent
  if (!json) return
  const island: IslandProps = parseIslandProps(json)
  const container = islandContainer(document, island.framed)
  if (!container) return
  // An add from the buy box opens the cart page, as the theme's own adds do (`ThemeCartAdded`).
  window.addEventListener(CART_ADDED_EVENT, () => window.location.assign(island.cartHref))
  hydrateRoot(container, createElement(BuyBox, { island }), {
    onRecoverableError: (error) => console.warn('[hono-island] hydration', error),
  })
  trackCommerce(island.viewContent)
}

start()
