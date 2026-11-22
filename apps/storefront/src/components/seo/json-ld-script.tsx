'use client'

import { takeLiquidSlot } from '@/lib/liquid-slots'

type JsonLdScriptProps = {
  /** The JSON itself: only on a request with no HTML render (a client navigation, an action). */
  json?: string | undefined
  /** Where the server parked the JSON for the HTML render (`lib/liquid-slots.ts`). */
  slot?: string | undefined
}

type InnerHtml = { __html: string }

const SLOT_ATTR = 'data-ld-slot'

/**
 * The JSON for a slot. On the server, the parked text. In the browser, the script already in the
 * DOM, read only if React asks (hydration keeps the server's children, so it normally never does).
 */
function slotJson(slot: string): InnerHtml {
  if (typeof document === 'undefined') return { __html: takeLiquidSlot(slot) ?? '' }
  let json: string | undefined
  return {
    get __html() {
      json ??= document.querySelector(`[${SLOT_ATTR}="${CSS.escape(slot)}"]`)?.textContent ?? ''
      return json
    },
  }
}

/**
 * A page's structured data (`<script type="application/ld+json">`), written into the HTML once:
 * on a page load the RSC payload carries only the slot id (`./json-ld.tsx`), as theme markup does
 * (`components/theme/liquid-slot.tsx`).
 */
export default function JsonLdScript({ json, slot }: JsonLdScriptProps) {
  // Render logic
  const content = json !== undefined || !slot ? { __html: json ?? '' } : slotJson(slot)

  return (
    <script
      type="application/ld+json"
      {...{ [SLOT_ATTR]: slot }}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD from our own data; jsonLd() escapes `<`.
      dangerouslySetInnerHTML={content}
    />
  )
}
