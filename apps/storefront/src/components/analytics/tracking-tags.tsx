'use client'

import { usePathname } from 'next/navigation'
import Script from 'next/script'
import { trackingAllowedOn } from '@/lib/tracking-paths'

type TrackingTagsProps = {
  /** Ids already validated against their formats (G-…, GTM-…, digits) and cleared by consent. */
  ga4: string | null
  gtm: string | null
  metaPixel: string | null
  /**
   * The request's script CSP nonce (`lib/csp.ts`). The inline loaders need it; the scripts
   * they load (gtag.js, gtm.js, fbevents.js) are then trusted through `strict-dynamic`.
   */
  nonce?: string | undefined
}

/**
 * Google Analytics 4, Tag Manager and the Meta pixel. Rendered only with ids the
 * consent banner allows; the ids match strict patterns, so inlining them is safe.
 * `lazyOnload`: they are injected once the page has loaded and the browser is idle,
 * so they never compete with the hero image (LCP) or the first tap (INP). Never on
 * sign-in pages, whose URLs carry single-use tokens (`trackingAllowedOn`).
 */
export default function TrackingTags({ ga4, gtm, metaPixel, nonce }: TrackingTagsProps) {
  // Hooks
  const pathname = usePathname()

  // Early returns
  if (!trackingAllowedOn(pathname)) return null

  // Render logic
  return (
    <>
      {ga4 ? (
        <>
          <Script
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`}
            strategy="lazyOnload"
            nonce={nonce}
          />
          <Script id="ga4-init" strategy="lazyOnload" nonce={nonce}>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga4}');`}
          </Script>
        </>
      ) : null}
      {gtm ? (
        <Script id="gtm-init" strategy="lazyOnload" nonce={nonce}>
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
        </Script>
      ) : null}
      {metaPixel ? (
        <Script id="meta-pixel-init" strategy="lazyOnload" nonce={nonce}>
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`}
        </Script>
      ) : null}
    </>
  )
}
