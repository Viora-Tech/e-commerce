'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { trackingAllowedOn } from '@/lib/tracking-paths'
import { fbqInit, gtagInit, gtmInit } from '@/lib/tracking-snippets'

type TrackingTagsProps = {
  /** Ids already validated against their formats (G-…, GTM-…, digits) and cleared by consent. */
  ga4: string | null
  gtm: string | null
  /** The old single pixel (Online Store preferences) for stores without the Pixels app: PageView only. */
  metaPixel: string | null
  /**
   * The Pixels app's pixel ids (digits only), cleared by marketing consent. Each is initialised;
   * every event, PageView included, is then sent by `PixelEvents` with its event id.
   */
  pixels?: readonly string[] | undefined
  /** Google Ads tag (AW-…), cleared by marketing consent; shares gtag.js with GA4. */
  googleAds?: string | null | undefined
  /**
   * The request's script CSP nonce (`lib/csp.ts`). The inline loaders need it; the scripts
   * they load (gtag.js, gtm.js, fbevents.js) are then trusted through `strict-dynamic`. The
   * Tag Manager loader is Google's nonce-aware snippet: it copies the nonce onto gtm.js, so
   * Tag Manager can hand it to the merchant's Custom HTML tags (inline code still needs it).
   */
  nonce?: string | undefined
}

/**
 * Google Analytics 4, Google Ads, Tag Manager and the Meta pixel. Rendered only with ids the
 * consent banner allows; the ids match strict patterns, so inlining them is safe.
 * `lazyOnload`: they are injected once the page has loaded and the browser is idle,
 * so they never compete with the hero image (LCP) or the first tap (INP). Never on
 * sign-in pages, whose URLs carry single-use tokens (`trackingAllowedOn`).
 */
export default function TrackingTags({
  ga4,
  gtm,
  metaPixel,
  pixels = [],
  googleAds,
  nonce,
}: TrackingTagsProps) {
  // Hooks
  const pathname = usePathname()

  // Helpers
  const gtagIds = [ga4, googleAds].filter((id): id is string => Boolean(id))
  const meta = fbqInit(pixels, metaPixel)

  // Early returns
  if (!trackingAllowedOn(pathname)) return null

  // Render logic
  return (
    <>
      {gtagIds.length ? (
        <>
          <Script
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagIds[0]}`}
            strategy="lazyOnload"
            nonce={nonce}
          />
          <Script id="ga4-init" strategy="lazyOnload" nonce={nonce}>
            {gtagInit(gtagIds)}
          </Script>
        </>
      ) : null}
      {gtm ? (
        <Script id="gtm-init" strategy="lazyOnload" nonce={nonce}>
          {gtmInit(gtm)}
        </Script>
      ) : null}
      {meta ? (
        <Script id="meta-pixel-init" strategy="lazyOnload" nonce={nonce}>
          {meta}
        </Script>
      ) : null}
    </>
  )
}
