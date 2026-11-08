# Lean Next.js builds (8 Nov 2026)

Admin and storefront image builds are about 5x faster and peak about 30% lower, so they fit a
4 GB machine with 4 GB of swap.

## What changed
- `packages/config/src/lean-build.ts` (`leanBuild`), applied to both apps' production
  `next.config.ts`:
  - React Compiler in Rust inside Turbopack (`experimental.turbopackRustReactCompiler`, Next
    16.3+, experimental) instead of Babel. `BUILD_RUST_RC=0` goes back to Babel.
  - Turbopack's build file-system cache off (on by default since 16.3; raises the peak on cold
    builds, vercel/next.js#100086, #99579). `BUILD_TURBO_CACHE=1` keeps it.
  - No Turbopack / prerender source maps (never uploaded).
  - `optimizePackageImports` for `@hugeicons/core-free-icons`.
  - `BUILD_TYPECHECK=0` skips Next's TypeScript 5.9 pass (types are checked before every PR
    with TypeScript 7, `bun run typecheck`); `BUILD_CPUS` caps page workers.
  - `BUILD_LEAN=0` turns everything off.
- `packages/ui/src/icons.tsx`: named imports instead of `import * as Huge` (the namespace import
  pulled all ~6,000 icons into every admin page).
- Dockerfiles: `BUILD_TYPECHECK=0`, `BUILD_CPUS=2`, heap cap 4096.
- Dropped idea: `turbopackPluginRuntimeStrategy: 'workerThreads'` broke builds at random
  (Babel/PostCSS "Error evaluating Node.js code").

## Measured (Docker, cold cache, 12-core PC)
| | Admin | Storefront |
|---|---|---|
| Before | 8.7 GB, 8m49s | 6.3 GB, 4m49s |
| After | 5.9 GB, 1m47s | 4.6 GB, 58s |
| After, 4 GB RAM + 4 GB swap | 2m25s | 1m11s |
| After, 4 GB RAM no swap | out of memory | out of memory |

## Before release
The Rust React Compiler is experimental: smoke-test admin and storefront on the dev server
(vioratech.in) before the next production release. Production's 4 GB server must keep pulling
images, not building (only ~1.4 GB free with the shop running).
