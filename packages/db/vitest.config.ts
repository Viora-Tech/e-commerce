import { loadTestEnv } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('db', '../../.env.test')

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/migrate.ts', 'src/schema.ts'],
      thresholds: { lines: 90, functions: 90, branches: 80 },
    },
  },
})
