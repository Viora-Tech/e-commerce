import { describe, expect, it } from 'vitest'
import { logOptions, logSampling, PRODUCTION_SAMPLE_PERCENT, SLOW_MS } from '../src/log-options'

describe('logSampling', () => {
  it('samples ordinary events in production and keeps every warning and error', () => {
    const sampling = logSampling({ NODE_ENV: 'production', LOG_SAMPLE_RATE: undefined })
    expect(sampling.rates).toEqual({
      info: PRODUCTION_SAMPLE_PERCENT,
      debug: PRODUCTION_SAMPLE_PERCENT,
      warn: 100,
      error: 100,
    })
  })

  it('always keeps failed and slow requests', () => {
    const sampling = logSampling({ NODE_ENV: 'production', LOG_SAMPLE_RATE: undefined })
    expect(sampling.keep).toEqual([{ status: 400 }, { duration: SLOW_MS }])
  })

  it('keeps everything in development', () => {
    expect(logSampling({ NODE_ENV: 'development', LOG_SAMPLE_RATE: undefined }).rates?.info).toBe(
      100,
    )
    expect(logSampling({ NODE_ENV: undefined, LOG_SAMPLE_RATE: undefined }).rates?.info).toBe(100)
  })

  it('takes LOG_SAMPLE_RATE over the default', () => {
    expect(logSampling({ NODE_ENV: 'production', LOG_SAMPLE_RATE: 5 }).rates?.info).toBe(5)
    expect(logSampling({ NODE_ENV: 'development', LOG_SAMPLE_RATE: 0 }).rates?.info).toBe(0)
  })
})

describe('logOptions', () => {
  const env = {
    NODE_ENV: 'production',
    SENTRY_ENVIRONMENT: 'staging',
    SENTRY_RELEASE: 'c211bc0c',
    LOG_SAMPLE_RATE: undefined,
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: undefined,
  }

  it('names the service and environment, JSON output in production', () => {
    const options = logOptions('worker', env)
    expect(options.env).toEqual({ service: 'worker', environment: 'staging', version: 'c211bc0c' })
    expect(options.pretty).toBe(false)
  })

  it('pretty output outside production', () => {
    expect(logOptions('admin', { ...env, NODE_ENV: 'development' }).pretty).toBe(true)
  })

  it("scrubs with our own rules only, never evlog's built-in patterns", () => {
    const redact = logOptions('storefront', env).redact
    expect(redact).toMatchObject({ builtins: false })
  })

  it('has no drain without an endpoint', () => {
    expect(logOptions('worker', env).drain).toBeUndefined()
  })
})
