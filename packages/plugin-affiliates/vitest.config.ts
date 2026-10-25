import { loadTestEnv, parallelDbTests } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('affiliates', '../../.env.test')

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // One database copy per worker (TEST_WORKERS, default 3): see parallelDbTests.
    ...parallelDbTests(),
    testTimeout: 30000,
  },
})
