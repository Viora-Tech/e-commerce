/**
 * The Google and Meta tag snippets, shared by the React consent manager (`TrackingTags`) and the
 * plain HTML pages' consent island (`lib/plain-html/islands.ts`). Ids are validated against
 * their formats before they reach here, so inlining them is safe. Pure.
 */

/** gtag.js loads once for every Google tag (GA4 and Ads); each id is then configured. */
export function gtagInit(ids: string[]): string {
  const config = ids.map((id) => `gtag('config','${id}');`).join('')
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());${config}`
}

export const FBQ_LOADER =
  "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');"

const PIXEL_ID = /^[0-9]{10,20}$/

/** fbevents.js once, then each pixel; the legacy single pixel also tracks its PageView. */
export function fbqInit(pixels: readonly string[], legacy: string | null): string {
  const ids = pixels.filter((id) => PIXEL_ID.test(id))
  if (ids.length) return FBQ_LOADER + ids.map((id) => `fbq('init','${id}');`).join('')
  return legacy ? `${FBQ_LOADER}fbq('init','${legacy}');fbq('track','PageView');` : ''
}

/** Google's nonce-aware Tag Manager loader: it copies the nonce onto gtm.js. */
export function gtmInit(id: string): string {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;var n=d.querySelector('[nonce]');n&&j.setAttribute('nonce',n.nonce||n.getAttribute('nonce'));j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');`
}
