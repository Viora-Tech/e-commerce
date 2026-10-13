import {
  BROWSER_SENTRY_META,
  type BrowserSentryConfig,
  browserSentryOptions,
  type EarlyBrowserErrors,
  readBrowserSentryConfig,
} from '@commerce/observability'
import {
  BrowserClient,
  breadcrumbsIntegration,
  browserApiErrorsIntegration,
  captureException,
  dedupeIntegration,
  defaultStackParser,
  functionToStringIntegration,
  globalHandlersIntegration,
  httpContextIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
  setCurrentClient,
} from '@sentry/nextjs'

/**
 * Browser errors to GlitchTip. A bare `BrowserClient` with only the integrations an error
 * needs, instead of `Sentry.init`, which would also bundle tracing and sessions. Options
 * (filters, once per bug, query strings and PII stripped) come from `@commerce/observability`.
 * Started from `instrumentation-client.ts`, and only when the server rendered a DSN.
 */

/** The config the root layout rendered (`browserSentryMeta`), once the tag is in the DOM. */
export function renderedSentryConfig(): BrowserSentryConfig | undefined {
  const meta = document.querySelector<HTMLMetaElement>(`meta[name="${BROWSER_SENTRY_META}"]`)
  return readBrowserSentryConfig(meta?.content)
}

let started = false

export function startBrowserErrors(config: BrowserSentryConfig, early: EarlyBrowserErrors): void {
  if (started) return
  started = true
  const client = new BrowserClient({
    ...browserSentryOptions(config, window.location.origin),
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
      browserApiErrorsIntegration(),
      functionToStringIntegration(),
      breadcrumbsIntegration(),
    ],
  })
  setCurrentClient(client)
  client.init()
  early.flush((error) => {
    captureException(error, { mechanism: { type: 'onerror', handled: false } })
  })
}

/** For error boundaries, which catch what never reaches `window.onerror`. A no-op without a DSN. */
export function reportBrowserError(error: unknown): void {
  if (started) captureException(error)
}
