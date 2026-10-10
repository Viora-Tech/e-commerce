import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The same `@/` alias as tsconfig, so tested modules can import copy from `@/data`.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // tsconfig keeps JSX for Next (`jsx: preserve`); copy files reach icon components through
  // `data/hi`, so tests compile JSX themselves.
  oxc: { jsx: { runtime: 'automatic' } },
  // Component tests (`*.test.tsx`) opt into a DOM with `// @vitest-environment jsdom`;
  // `test/dom.ts` adds what jsdom lacks and unmounts after each test.
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], setupFiles: ['./test/dom.ts'] },
})
