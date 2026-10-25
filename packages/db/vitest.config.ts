import { loadTestEnv, parallelDbTests } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('db', '../../.env.test')

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // One database copy per worker (TEST_WORKERS, default 3): see parallelDbTests.
    ...parallelDbTests(),
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/migrate.ts', 'src/schema.ts'],
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
})
