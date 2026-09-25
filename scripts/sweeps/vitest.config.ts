import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/sweeps/**/*.test.ts'],
    testTimeout: 30000,
  },
})
