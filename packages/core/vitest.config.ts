import { loadTestEnv } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('core', '../../.env.test')

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/migrate.ts'],
      thresholds: { lines: 95, functions: 95, branches: 75 },
    },
  },
})
