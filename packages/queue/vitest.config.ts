import { loadTestEnv, testWorkers } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('queue', '../../.env.test')

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Every file uses its own per-worker Redis key prefix, so files can run side by side.
    maxWorkers: testWorkers(),
    testTimeout: 20000,
  },
})
