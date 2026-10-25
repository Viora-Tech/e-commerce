import { defineConfig } from 'vitest/config'

/** Pure logic and a faked GrowthBook API only: no database, no network. */
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
