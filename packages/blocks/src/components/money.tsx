'use client'

import type { PresentmentLine } from '@commerce/money'
import { useFormatCart, useFormatPaise } from '../money-format'

type MoneyProps = {
  paise: number
  /**
   * An amount built on this cart's subtotal (subtotal, total): it agrees with the lines when a
   * market's catalog fixes their prices (`useFormatCart`).
   */
  cart?: { lines: readonly PresentmentLine[]; subtotalPaise: number } | undefined
}

/**
 * A price as this page shows prices (`useFormatPaise`): the market's currency on `/ae`, the
 * store's own format otherwise. For server components, which cannot read the price context.
 */
export default function Money({ paise, cart }: MoneyProps) {
  // Hooks
  const formatPaise = useFormatPaise()
  const money = useFormatCart()

  // Render logic
  return <>{cart ? money.cart(paise, cart.lines, cart.subtotalPaise) : formatPaise(paise)}</>
}
