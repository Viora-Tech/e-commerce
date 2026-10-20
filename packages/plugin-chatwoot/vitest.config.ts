import { defineConfig } from 'vitest/config'

/** Pure logic and a faked Chatwoot API only: no database, no network. */
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
