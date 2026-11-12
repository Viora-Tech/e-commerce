import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pure modules only (the island's props and placement, the forward check): the server itself runs
// on Bun with the preload swap (`src/preload.ts`), which vitest does not load.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../storefront/src', import.meta.url)),
      'server-only': fileURLToPath(new URL('../storefront/test/server-only.ts', import.meta.url)),
    },
  },
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['src/**/*.test.ts'] },
})
