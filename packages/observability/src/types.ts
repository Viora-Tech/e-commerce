/**
 * What a host app hands the API layer and the worker so they can report an
 * unexpected error without this package (or `@commerce/api`) depending on
 * any particular Sentry SDK. `tags` never carries PII — callers pass ids
 * (store, job, queue), not customer data.
 */
export type ErrorReporter = (error: unknown, tags: Record<string, string>) => void
