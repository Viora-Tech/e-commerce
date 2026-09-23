import { loadTestEnv } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('shopify_import', '../../.env.test')

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
  },
})
