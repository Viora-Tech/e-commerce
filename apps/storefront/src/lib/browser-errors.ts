import {
  type BrowserSentryConfig,
  browserSentryOptions,
  type EarlyBrowserErrors,
} from '@commerce/observability'
import {
  BrowserClient,
  captureException,
  dedupeIntegration,
  defaultStackParser,
  globalHandlersIntegration,
  httpContextIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
  setCurrentClient,
} from '@sentry/nextjs'

/**
 * Browser errors to GlitchTip, kept as small as the SDK allows for shoppers' phones: a bare
 * `BrowserClient` with only uncaught errors and rejections (`globalHandlers`), error causes,
 * repeat suppression and the page URL/user agent. No `Sentry.init` (it bundles tracing and
 * sessions), no breadcrumbs, no replay. Options (filters, once per bug, query strings and PII
 * stripped) come from `@commerce/observability`. `instrumentation-client.ts` imports this
 * chunk lazily, and only when the server rendered a DSN.
 */
export function startBrowserErrors(config: BrowserSentryConfig, early: EarlyBrowserErrors): void {
  const client = new BrowserClient({
    ...browserSentryOptions(config, window.location.origin),
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
    ],
  })
  setCurrentClient(client)
  client.init()
  early.flush((error) => {
    captureException(error, { mechanism: { type: 'onerror', handled: false } })
  })
}
