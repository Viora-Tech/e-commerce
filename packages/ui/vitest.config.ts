import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig keeps JSX for Next (`jsx: preserve`); component tests compile JSX themselves.
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['src/**/*.test.ts'] },
})
