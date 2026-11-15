import { createElement, isValidElement, type ReactNode } from 'react'
import RichHtml from './components/rich-html'
import { asLexical } from './lexical-html'
import { richtextHtml } from './richtext-html'
import type { MainProductSettings } from './sections/main-product-settings'
import type { ProductFieldText } from './types'

/**
 * SOURCE OF TRUTH KEYWORDS: richtextNode, sanitise on the server, RichHtml
 * WHAT:  A stored body-copy value (Puck richtext HTML, a legacy plain string, Lexical JSON)
 *        sanitised here and wrapped as a `RichHtml` element; anything else (the React node Puck
 *        hands over while editing, nothing) is returned as it is.
 * WHY:   Client sections draw body copy with `RichCopy` in the browser too. Given this element
 *        they draw the server's HTML and the browser never loads sanitize-html. An element
 *        cannot be forged from saved data (a stored object never becomes one), so `RichCopy`
 *        trusts only these.
 * WHERE: `sections/framed.tsx` (every section's richtext fields), the storefront's product page
 *        (`MainProduct` accordions, offer panel, product fields) and layout (cookie banner).
 */
export function richtextNode(value: unknown): ReactNode {
  // Blank copy stays blank, so a section's `text || fallback` reads it as before.
  if (typeof value === 'string' && !value.trim()) return value
  if (typeof value === 'string' || asLexical(value)) {
    return createElement(RichHtml, { html: richtextHtml(value), sanitised: true })
  }
  return value as ReactNode
}

/** Whether body copy shows nothing: sanitised to empty, or a stored value that sanitises to empty. */
export function isBlankRichtext(value: unknown): boolean {
  if (isValidElement<{ html?: unknown; sanitised?: unknown }>(value) && value.props.sanitised) {
    return !value.props.html
  }
  return typeof value === 'string' && !richtextHtml(value)
}

/** `MainProduct` settings with the copy ProductView draws in the browser sanitised here. */
export function mainProductRichtext(settings: MainProductSettings): MainProductSettings {
  return {
    ...settings,
    offerBody: richtextNode(settings.offerBody),
    accordions: settings.accordions.map((a) => ({ ...a, body: richtextNode(a.body) })),
  }
}

/** A product's extra fields with their panel HTML sanitised here (ProductView's accordions). */
export function productFieldsRichtext(
  fields: Record<string, ProductFieldText> | undefined,
): Record<string, ProductFieldText> | undefined {
  if (!fields) return fields
  return Object.fromEntries(
    Object.entries(fields).map(([key, f]) => [key, { ...f, html: richtextNode(f.html) }]),
  )
}
