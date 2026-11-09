import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * SPIKE (do not ship): the admin Orders list on TanStack Start, reusing apps/admin's own
 * components unchanged. `@/` points into apps/admin/src; every Next.js module those files
 * import is answered by a thin shim in src/shims (the list is the migration cost, see
 * docs/research/2026-11-tanstack-start-spike.md).
 */
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const ADMIN_API = process.env.ADMIN_API ?? 'http://localhost:3200'

export default defineConfig({
  server: { port: 3300, proxy: { '/api': { target: ADMIN_API, changeOrigin: false } } },
  preview: { port: 3300, proxy: { '/api': { target: ADMIN_API, changeOrigin: false } } },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: `${here('../admin/src')}/$1` },
      { find: /^~\/(.*)$/, replacement: `${here('./src')}/$1` },
      { find: /^next\/link$/, replacement: here('./src/shims/next-link.tsx') },
      { find: /^next\/navigation$/, replacement: here('./src/shims/next-navigation.ts') },
      { find: /^next\/image$/, replacement: here('./src/shims/next-image.tsx') },
      { find: /^next\/dynamic$/, replacement: here('./src/shims/next-dynamic.tsx') },
      { find: /^@sentry\/nextjs$/, replacement: here('./src/shims/sentry.ts') },
    ],
  },
  plugins: [
    tailwindcss(),
    // SPA mode: one prerendered shell page plus client bundles; any static host can serve it.
    tanstackStart({ spa: { enabled: true } }),
    react(),
    // Same React Compiler the admin runs (`reactCompiler: true` in next.config.ts), through
    // Babel. `LAB_COMPILER=off` skips it (to see what it costs the build).
    ...(process.env.LAB_COMPILER === 'off' ? [] : [babel({ presets: [reactCompilerPreset()] })]),
  ],
})
