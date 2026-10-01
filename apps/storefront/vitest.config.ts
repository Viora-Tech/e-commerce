import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The same `@/` alias as tsconfig, so tested modules can import copy from `@/data`.
  // `server-only` is aliased to an empty stub: see test/server-only.ts.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/server-only.ts', import.meta.url)),
    },
  },
  // tsconfig keeps JSX as-is for Next; tests compile it to the automatic runtime.
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['src/**/*.test.ts'] },
})
