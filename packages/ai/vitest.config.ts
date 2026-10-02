import { defineConfig } from 'vitest/config'

/* No database: the engine is tested against the AI SDK's mock models only. */
export default defineConfig({ test: { include: ['test/**/*.test.ts'] } })
