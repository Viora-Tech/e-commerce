import { fileURLToPath } from 'node:url'
import { loadTestEnv, parallelDbTests } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('api', '../../.env.test')

export default defineConfig({
  // Storefront loaders under test start with `import 'server-only'`; see test/support/server-only.ts.
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./test/support/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // One database copy per worker (TEST_WORKERS, default 3): see parallelDbTests.
    ...parallelDbTests(),
    testTimeout: 20000,
  },
})
