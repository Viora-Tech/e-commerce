import type { Env } from '@commerce/config'
import { type DrainContext, initLogger, type LoggerConfig, type SamplingConfig } from 'evlog'
import { createOTLPDrain } from 'evlog/otlp'
import { createDrainPipeline, type PipelineDrainFn } from 'evlog/pipeline'
import { scrubLogEvent } from './scrub-log-event'

/** The process a wide event came from; the `service` field on every event. */
export type LogService = 'admin' | 'storefront' | 'worker'

export type LogEnv = Pick<
  Env,
  | 'NODE_ENV'
  | 'SENTRY_ENVIRONMENT'
  | 'SENTRY_RELEASE'
  | 'LOG_SAMPLE_RATE'
  | 'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT'
>

/** A request, procedure call or job at least this slow is always kept, whatever the sample rate. */
export const SLOW_MS = 1000
/** Ordinary successful events kept in production when LOG_SAMPLE_RATE is unset (percent). */
export const PRODUCTION_SAMPLE_PERCENT = 20

/**
 * Head sampling for ordinary events, tail rules for the ones that matter: every warning and
 * error, every response with status 400 or above, and anything that took `SLOW_MS` or more is
 * kept. Development keeps everything unless LOG_SAMPLE_RATE says otherwise.
 */
export function logSampling(env: Pick<LogEnv, 'NODE_ENV' | 'LOG_SAMPLE_RATE'>): SamplingConfig {
  const percent =
    env.LOG_SAMPLE_RATE ?? (env.NODE_ENV === 'production' ? PRODUCTION_SAMPLE_PERCENT : 100)
  return {
    rates: { info: percent, debug: percent, warn: 100, error: 100 },
    keep: [{ status: 400 }, { duration: SLOW_MS }],
  }
}

let drain: PipelineDrainFn<DrainContext> | undefined

/**
 * Batched OTLP/HTTP drain, or none when no endpoint is set. evlog reads the endpoint (as the
 * full logs URL) and `OTEL_EXPORTER_OTLP_HEADERS` from the environment itself; `compact` record
 * shape flattens nested fields to dotted attributes (`job.queue`), which OpenObserve can filter on.
 */
function otlpDrain(env: LogEnv): PipelineDrainFn<DrainContext> | undefined {
  if (!env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) return undefined
  const pipeline = createDrainPipeline<DrainContext>({
    batch: { size: 50, intervalMs: 5000 },
    retry: { maxAttempts: 3 },
    maxBufferSize: 1000,
    // The logger cannot report its own delivery failure; stderr is all that is left.
    onDropped: (events, error) =>
      console.error(
        `[logging] dropped ${events.length} log events: ${error?.message ?? 'buffer full'}`,
      ),
  })
  return pipeline(createOTLPDrain({ recordShape: 'compact' }))
}

/**
 * SOURCE OF TRUTH KEYWORDS: logOptions, initLogging, evlog, LOG_SAMPLE_RATE, OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
 * WHAT:  The evlog logger config for every app: service name, environment, sampling, PII
 *        scrubbing and the optional OTLP drain. JSON on stdout in production, pretty in dev.
 * WHY:   Admin, storefront and worker must sample, scrub and ship logs the same way; one
 *        config means a privacy or sampling change lands everywhere at once.
 * WHERE: worker `src/index.ts` (`initLogging`), admin/storefront `instrumentation.ts`
 *        (`nextLogInstrumentation`); see docs/ops/logging.md.
 */
export function logOptions(
  service: LogService,
  env: LogEnv,
): LoggerConfig & { env: NonNullable<LoggerConfig['env']> } {
  const production = env.NODE_ENV === 'production'
  drain ??= otlpDrain(env)
  return {
    env: {
      service,
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? 'development',
      ...(env.SENTRY_RELEASE ? { version: env.SENTRY_RELEASE } : {}),
    },
    pretty: !production,
    minLevel: production ? 'info' : 'debug',
    sampling: logSampling(env),
    // Our scrubber only: evlog's own patterns would mask the timestamp and record ids.
    redact: { builtins: false, transform: scrubLogEvent },
    ...(drain ? { drain } : {}),
  }
}

/** Starts the process-wide logger (the worker; the Next apps go through `nextLogInstrumentation`). */
export function initLogging(service: LogService, env: LogEnv): void {
  initLogger(logOptions(service, env))
}

/** Sends whatever the OTLP drain still holds; call before the process exits. */
export async function flushLogs(): Promise<void> {
  await drain?.flush()
}
