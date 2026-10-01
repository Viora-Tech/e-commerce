'use client'

import { formatCountdown, msUntil } from '@commerce/dates'
import { useEffect, useState } from 'react'

/**
 * What the storefront hands this block through
 * `puck.metadata.appBlockContext.preorderCountdown` — the product's launch
 * settings, the same "metadata carries what a block cannot load on its own"
 * pattern `NotifyMeBlock` and the dynamic sections use.
 */
export type PreorderCountdownContext = {
  enabled: boolean
  launchAt: string | null
}

type PreorderCountdownBlockProps = {
  label: string
  style: 'compact' | 'large'
  context: PreorderCountdownContext | undefined
}

/** Milliseconds until `launchAt`, clamped to zero. Mirrors ProductView's own (duplicated
 *  rather than shared, since packages/blocks does not depend on @commerce/core). */
/**
 * App block version of the launch countdown (Add panel → Apps), for
 * merchants who want it somewhere other than under the buy box, e.g. a
 * banner near the top of the page. Draws nothing once the product has
 * launched or is not on pre-order.
 */
export default function PreorderCountdownBlock({
  label,
  style,
  context,
}: PreorderCountdownBlockProps) {
  // Hooks
  const [ms, setMs] = useState(() => msUntil(context?.launchAt))

  useEffect(() => {
    if (ms <= 0) return
    const id = setInterval(() => setMs(msUntil(context?.launchAt)), 30_000)
    return () => clearInterval(id)
  }, [ms, context?.launchAt])

  // Early returns
  if (!context?.enabled || ms <= 0) return null

  return (
    <div className={`app-block-countdown app-block-countdown--${style}`} role="status">
      <span className="app-block-countdown__label text-caption">{label}</span>
      <span className="app-block-countdown__value">{formatCountdown(ms)}</span>
    </div>
  )
}
