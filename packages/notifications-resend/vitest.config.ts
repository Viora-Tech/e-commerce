import { defineConfig } from 'vitest/config'

// Every test mocks fetch: nothing here ever calls Resend's live API.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 20000 } })
