import { afterEach, describe, expect, it } from 'vitest'
import { parallelDbTests, testWorkers, useWorkerDatabase, workerDatabaseUrl } from './test-env'

const saved = { ...process.env }

afterEach(() => {
  process.env = { ...saved }
})

describe('testWorkers', () => {
  it('defaults to 3 and honours TEST_WORKERS', () => {
    delete process.env.TEST_WORKERS
    expect(testWorkers()).toBe(3)
    process.env.TEST_WORKERS = '1'
    expect(testWorkers()).toBe(1)
    expect(parallelDbTests()).toMatchObject({ fileParallelism: false, maxWorkers: 1 })
  })

  it('rejects nonsense', () => {
    for (const bad of ['0', '9', '2.5', 'many']) {
      process.env.TEST_WORKERS = bad
      expect(testWorkers).toThrow(/TEST_WORKERS/)
    }
  })
})

describe('workerDatabaseUrl', () => {
  const url = 'postgres://app:app@localhost:5432/commerce_test_ns_api'

  it('appends the worker id once, however often it runs', () => {
    expect(workerDatabaseUrl(url, 2)).toBe(
      'postgres://app:app@localhost:5432/commerce_test_ns_api_w2',
    )
    expect(workerDatabaseUrl(workerDatabaseUrl(url, 2), 2)).toBe(workerDatabaseUrl(url, 2))
  })

  it('refuses names Postgres would truncate', () => {
    const long = `postgres://p@localhost/commerce_test_${'x'.repeat(32)}_shopify_import`
    expect(() => workerDatabaseUrl(long, 3)).toThrow(/63 characters/)
  })
})

describe('useWorkerDatabase', () => {
  it('moves both URLs and the upload folder onto this worker', () => {
    process.env.VITEST_POOL_ID = '3'
    process.env.DATABASE_URL = 'postgres://app:app@localhost:5432/commerce_test_core'
    process.env.DATABASE_URL_OWNER =
      'postgres://postgres:postgres@localhost:5432/commerce_test_core'
    delete process.env.LOCAL_STORAGE_DIR
    useWorkerDatabase()
    useWorkerDatabase()
    expect(process.env.DATABASE_URL).toMatch(/\/commerce_test_core_w3$/)
    expect(process.env.DATABASE_URL_OWNER).toMatch(/\/commerce_test_core_w3$/)
    expect(process.env.LOCAL_STORAGE_DIR).toMatch(/commerce_test_core_w3$/)
  })
})
