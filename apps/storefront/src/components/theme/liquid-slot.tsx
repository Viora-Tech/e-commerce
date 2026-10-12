'use client'

import { createElement, useState } from 'react'
import { takeLiquidSlot } from '@/lib/liquid-slots'

type LiquidSlotProps = {
  /** The markup itself: only on a request with no HTML render (a client navigation, an action). */
  html?: string | undefined
  /** Where the server parked the markup for the HTML render (`lib/liquid-slots.ts`). */
  slot?: string | undefined
  /** The markup's digest without the request's nonce: a new one means the markup changed. */
  digest: string
  tag?: string | undefined
  id?: string | undefined
  className?: string | undefined
}

type InnerHtml = { __html: string }

type Shown = { digest: string; content: InnerHtml }

const SLOT_ATTR = 'data-liquid-slot'

/**
 * The markup for a slot. On the server, the parked HTML. In the browser, the markup already in
 * the DOM, read only if React asks: hydration never does (it keeps the server's children), so
 * a page that hydrates cleanly never serialises its sections. React reads it when it has to
 * build the element afresh (after a hydration error), while the server's element is still in
 * the document.
 */
function slotHtml(slot: string): InnerHtml {
  if (typeof document === 'undefined') return { __html: takeLiquidSlot(slot) ?? '' }
  let html: string | undefined
  return {
    get __html() {
      html ??= document.querySelector(`[${SLOT_ATTR}="${CSS.escape(slot)}"]`)?.innerHTML ?? ''
      return html
    },
  }
}

function initial(html: string | undefined, slot: string | undefined): InnerHtml {
  return html !== undefined || !slot ? { __html: html ?? '' } : slotHtml(slot)
}

/**
 * Markup rendered by an imported Shopify theme's Liquid (`lib/liquid-theme.ts`), drawn once: the
 * server writes it into the page and the RSC payload carries only the slot id
 * (`components/theme/liquid-html.tsx`). A later server render (an action's refresh) replaces it
 * only when its digest changed, so a new nonce alone never resets the theme's markup and the
 * state its scripts bound to it. With no wrapper of its own it sits in a `display: contents`
 * box, so the theme's CSS sees the same structure it does on Shopify.
 */
export default function LiquidSlot({ html, slot, digest, tag, id, className }: LiquidSlotProps) {
  // Hooks
  const [shown, setShown] = useState<Shown>(() => ({ digest, content: initial(html, slot) }))

  // Helpers
  const changed = html !== undefined && digest !== shown.digest
  if (changed) setShown({ digest, content: { __html: html } })

  // Render logic
  const element = tag ?? 'div'
  const style = tag ? undefined : { display: 'contents' }
  const content = changed ? { __html: html } : shown.content

  return createElement(element, {
    id,
    className,
    style,
    [SLOT_ATTR]: slot,
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: content,
  })
}
