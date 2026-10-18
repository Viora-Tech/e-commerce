import 'server-only'
import { nextRequestLogging } from '@commerce/observability/logging/next'

/** Wrap a route handler in `withEvlog` for one wide event per request; docs/ops/logging.md. */
export const { withEvlog, useLogger } = nextRequestLogging('storefront')
