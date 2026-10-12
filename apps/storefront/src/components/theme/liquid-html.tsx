import { headers } from 'next/headers'
import LiquidSlot from '@/components/theme/liquid-slot'
import { NONCE_HEADER } from '@/lib/csp'
import { flightOnlyRequest } from '@/lib/flight-request'
import { markupDigest } from '@/lib/liquid-cache'
import { putLiquidSlot } from '@/lib/liquid-slots'

type LiquidHtmlProps = {
  html: string
  /** Shopify's section wrapper (`div`, `section`...); layout parts use a contents-only `div`. */
  tag?: string | undefined
  id?: string | undefined
  className?: string | undefined
}

/**
 * Markup rendered by an imported Shopify theme's Liquid (`lib/liquid-theme.ts`): a section
 * inside Shopify's own wrapper element, or a part of the theme's layout. For a page load the
 * markup reaches the HTML render through a slot (`lib/liquid-slots.ts`), so it is not repeated
 * in the RSC payload; a request answered with the payload alone (a client navigation, a server
 * action's refresh) carries it inline, since the browser has no server HTML to keep. Either way
 * a digest of the markup goes along, so the browser replaces what it shows only when the markup
 * really changed (a cart count after an action), not for a new nonce.
 */
export default async function LiquidHtml({ html, tag, id, className }: LiquidHtmlProps) {
  // Hooks
  const inline = await flightOnlyRequest()
  const nonce = (await headers()).get(NONCE_HEADER) ?? ''

  // Render logic
  const markup = inline ? { html } : { slot: putLiquidSlot(html) }

  return (
    <LiquidSlot
      {...markup}
      digest={markupDigest(html, nonce)}
      tag={tag}
      id={id}
      className={className}
    />
  )
}
