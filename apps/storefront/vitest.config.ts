import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The same `@/` alias as tsconfig, so tested modules can import copy from `@/data`.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // tsconfig keeps JSX as-is for Next; tests compile it to the automatic runtime.
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['src/**/*.test.ts'] },
})
