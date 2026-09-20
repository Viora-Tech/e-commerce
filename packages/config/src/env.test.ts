import { describe, expect, it } from 'vitest'
import { loadEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/commerce',
  DATABASE_URL_OWNER: 'postgres://postgres:postgres@localhost:5432/commerce',
  REDIS_URL: 'redis://localhost:6379',
  WORKER_PORT: '4100',
}

describe('loadEnv', () => {
  it('parses a valid environment and coerces the port', () => {
    const env = loadEnv(valid)
    expect(env.WORKER_PORT).toBe(4100)
    expect(env.REDIS_URL).toBe('redis://localhost:6379')
  })

  it('fails fast naming the missing key', () => {
    const { DATABASE_URL: _drop, ...rest } = valid
    expect(() => loadEnv(rest)).toThrow(/Invalid environment:.*DATABASE_URL/)
  })
})
