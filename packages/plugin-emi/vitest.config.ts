import { defineConfig } from 'vitest/config'

/** Pure logic and static renders only: no database, no network, no browser. */
export default defineConfig({ test: { include: ['test/**/*.test.ts', 'test/**/*.test.tsx'] } })
