'use client'

import { useFormatPaise } from '../money-format'

type MoneyProps = {
  paise: number
}

/**
 * A price as this page shows prices (`useFormatPaise`): the market's currency on `/ae`, the
 * store's own format otherwise. For server components, which cannot read the price context.
 */
export default function Money({ paise }: MoneyProps) {
  // Hooks
  const formatPaise = useFormatPaise()

  // Render logic
  return <>{formatPaise(paise)}</>
}
