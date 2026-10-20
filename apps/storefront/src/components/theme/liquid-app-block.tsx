'use client'

import { APP_BLOCK_SLOT_ATTR, type AppBlockSlot } from '@commerce/core/theme-import'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

type LiquidAppBlockProps = {
  /** The slot an imported theme's app block left (`data-commerce-app-block="reviews"`). */
  slot: AppBlockSlot
  /** Our widget that draws that app block. */
  children: ReactNode
}

/** The slot in the document, unless the one already held is still in it. */
function findSlot(slot: AppBlockSlot, held: HTMLElement | null): HTMLElement | null {
  if (held?.isConnected) return held
  return document.querySelector<HTMLElement>(`[${APP_BLOCK_SLOT_ATTR}="${slot}"]`)
}

/**
 * One of our widgets drawn where an imported theme had a Shopify app block (Judge.me's review
 * widget in a product tab): the Liquid HTML leaves a slot (`theme-import/app-blocks.ts`) and
 * this renders the widget into it. The theme's markup can arrive or be replaced after this
 * mounts (a client navigation, a re-render), so the slot is looked up again when the page
 * changes. Renders nothing on a page without the slot.
 */
export default function LiquidAppBlock({ slot, children }: LiquidAppBlockProps) {
  // Hooks
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const sync = () => setTarget((held) => findSlot(slot, held))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [slot])

  // Early returns
  if (!target) return null

  return createPortal(children, target)
}
