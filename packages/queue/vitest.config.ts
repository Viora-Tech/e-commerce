import { loadTestEnv } from '@commerce/config/test-env'
import { defineConfig } from 'vitest/config'

loadTestEnv('queue', '../../.env.test')

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
})
