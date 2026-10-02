import { createElement } from 'react'

type LiquidHtmlProps = {
  html: string
  /** Shopify's section wrapper (`div`, `section`...); layout parts use a contents-only `div`. */
  tag?: string | undefined
  id?: string | undefined
  className?: string | undefined
}

/**
 * Markup rendered by an imported Shopify theme's Liquid (`lib/liquid-theme.ts`): a
 * section inside Shopify's own wrapper element, or a part of the theme's layout. With
 * no wrapper of its own it sits in a `display: contents` box, so the theme's CSS sees
 * the same structure it does on Shopify.
 */
export default function LiquidHtml({ html, tag, id, className }: LiquidHtmlProps) {
  // Render logic
  const element = tag ?? 'div'
  const style = tag ? undefined : { display: 'contents' }

  return createElement(element, {
    id,
    className,
    style,
    suppressHydrationWarning: true,
    dangerouslySetInnerHTML: { __html: html },
  })
}
