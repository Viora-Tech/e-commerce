import { queueEarlyBrowserErrors } from '@commerce/observability'
import { config } from 'zod'
import { renderedSentryConfig, startBrowserErrors } from '@/lib/browser-errors'
import { installClientErrorBuffer } from '@/lib/client-errors'

/**
 * Runs in the browser before the app hydrates. Zod's object parser probes for `new Function`
 * the first time it runs; under the nonce script CSP (`lib/csp.ts`, no `'unsafe-eval'`) the
 * caught probe still files a `securitypolicyviolation`. `jitless` skips the probe; parsing is
 * unchanged.
 */
config({ jitless: true })

/* "Report a bug" sends the tab's recent errors; start remembering them from page load. */
installClientErrorBuffer()

/* Browser errors go to GlitchTip only when the root layout rendered a DSN (`browserSentryMeta`).
   This may run before that tag is parsed; errors thrown in between are held, then sent. */
const early = queueEarlyBrowserErrors(window)
function startErrorReporting() {
  const sentry = renderedSentryConfig()
  if (sentry) startBrowserErrors(sentry, early)
  else early.stop()
}
if (document.readyState === 'loading' && !renderedSentryConfig()) {
  document.addEventListener('DOMContentLoaded', startErrorReporting, { once: true })
} else {
  startErrorReporting()
}
