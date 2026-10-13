import {
  BROWSER_SENTRY_META,
  queueEarlyBrowserErrors,
  readBrowserSentryConfig,
} from '@commerce/observability'
import { config } from 'zod'

/**
 * Runs in the browser before the app hydrates. Zod's object parser probes for `new Function`
 * the first time it runs; under the nonce script CSP (`lib/csp.ts`, no `'unsafe-eval'`) the
 * caught probe still files a `securitypolicyviolation`. `jitless` skips the probe; parsing is
 * unchanged.
 */
config({ jitless: true })

/* Browser errors go to GlitchTip only when the store layout rendered a DSN (`browserSentryMeta`).
   The SDK is its own chunk, fetched once the page has loaded and gone idle, so it never competes
   with the shopper's first paint; errors thrown before then are held and sent when it starts. */
const early = queueEarlyBrowserErrors(window)

function whenIdleAfterLoad(run: () => void) {
  const idle = () =>
    'requestIdleCallback' in window
      ? requestIdleCallback(run, { timeout: 5000 })
      : setTimeout(run, 1000)
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
}

whenIdleAfterLoad(() => {
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${BROWSER_SENTRY_META}"]`)
  const sentry = readBrowserSentryConfig(meta?.content)
  if (!sentry) return early.stop()
  import('@/lib/browser-errors')
    .then(({ startBrowserErrors }) => startBrowserErrors(sentry, early))
    // The chunk failed to load (offline, a deploy replaced it): the page works without it.
    .catch(() => early.stop())
})
