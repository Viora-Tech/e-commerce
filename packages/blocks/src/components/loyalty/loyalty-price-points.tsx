'use client'

import { useEffect } from 'react'
import { loyaltyWidgetContent as copy } from '../../data/loyalty-widget'
import { loadEarnInfo } from './loyalty-client'
import { earnPreview, priceFromText } from './loyalty-math'
import type { LoyaltyEarnInfo } from './loyalty-types'

type LoyaltyPricePointsProps = {
  /** Imported themes: the merchant's CSS selector for prices; '' for none. */
  selector: string
  /** Our own product cards (`data-loyalty-price`). */
  ownCards: boolean
}

const DONE = 'klDone'
const LINE_CLASS = 'kl-card-points mt-1 block text-[0.8125rem] font-medium opacity-80'

/** Adds "Earn N points" under each price on the page that does not have one yet. */
function addLines(root: ParentNode, info: LoyaltyEarnInfo, selector: string, ownCards: boolean) {
  const found: Element[] = []
  if (ownCards) found.push(...root.querySelectorAll('[data-loyalty-price]'))
  if (selector) {
    try {
      found.push(...root.querySelectorAll(selector))
    } catch {
      // A selector the browser cannot read: nothing to add.
    }
  }
  for (const el of found) {
    if (!(el instanceof HTMLElement) || el.dataset[DONE]) continue
    el.dataset[DONE] = '1'
    const own = el.getAttribute('data-loyalty-price')
    const paise = own ? Number(own) : priceFromText(el.textContent)
    const points = paise ? earnPreview(paise, info) : 0
    if (points <= 0) continue
    const line = document.createElement('span')
    line.className = LINE_CLASS
    line.textContent = copy.product.card(copy.points(points, info.pointsName))
    el.insertAdjacentElement('afterend', line)
  }
}

/**
 * The Loyalty widget's "points under prices" option: a short "Earn N points" line under every
 * product card price (ours by `data-loyalty-price`, an imported theme's by the merchant's
 * selector), kept up as filters or infinite scroll add cards. Draws nothing itself.
 */
export default function LoyaltyPricePoints({ selector, ownCards }: LoyaltyPricePointsProps) {
  // Hooks
  useEffect(() => {
    let observer: MutationObserver | null = null
    let timer = 0
    let stopped = false
    void loadEarnInfo().then((info) => {
      if (stopped || !info || !info.live || info.pointsPer100 <= 0) return
      addLines(document, info, selector, ownCards)
      observer = new MutationObserver(() => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => addLines(document, info, selector, ownCards), 200)
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    return () => {
      stopped = true
      window.clearTimeout(timer)
      observer?.disconnect()
    }
  }, [selector, ownCards])

  // Render logic
  return null
}
