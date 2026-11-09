/** The part of Next's config these settings touch (no `next` dependency in this package). */
type BuildConfig = {
  enablePrerenderSourceMaps?: boolean
  typescript?: { ignoreBuildErrors?: boolean }
  experimental?: { optimizePackageImports?: string[] } & object
}

/**
 * Settings that make `next build` fit small machines (both apps' next.config.ts import this file by
 * relative path: Next's config loader only compiles TypeScript outside node_modules).
 *
 * On by default; `BUILD_LEAN=0` turns them all off (to compare). Each one keeps the app's
 * runtime behaviour the same:
 * - No Turbopack source maps: they are never uploaded (Sentry upload is off) and Next keeps
 *   them in memory for every module while it builds.
 * - `BUILD_CPUS` caps the build and page-data workers (each is a Node process with its own
 *   heap). Unset: Next's default, one per core.
 * - No Turbopack build cache (on by default since Next 16.3): measured to raise the peak a lot
 *   on cold builds (vercel/next.js#100086, #99579). `BUILD_TURBO_CACHE=1` keeps it, for a big
 *   builder with a warm cache mount.
 * - The React Compiler runs in Rust inside Turbopack instead of in Babel workers (experimental
 *   since Next 16.3; measured on admin: 8.7 GB / 8m49s → 5.9 GB / 1m47s with the rest of this
 *   list). `BUILD_RUST_RC=0` goes back to Babel.
 * - The icon pack is ~6,000 modules behind one barrel; `optimizePackageImports` loads only the
 *   icons used.
 * - `BUILD_TYPECHECK=0` skips the type check inside the build. Only for builds of code whose
 *   types were already checked (every PR runs `tsc` locally); the image Dockerfiles set it.
 */
export function leanBuild<T extends BuildConfig>(config: T, env = process.env): T {
  if (env.BUILD_LEAN === '0') return config
  const cpus = Number(env.BUILD_CPUS)
  const capped = Number.isInteger(cpus) && cpus > 0
  return {
    ...config,
    // Next's memory guide: source maps are also built for the prerender phase by default.
    enablePrerenderSourceMaps: false,
    typescript: {
      ...config.typescript,
      ignoreBuildErrors: env.BUILD_TYPECHECK === '0' || config.typescript?.ignoreBuildErrors,
    },
    experimental: {
      ...config.experimental,
      turbopackSourceMaps: false,
      turbopackInputSourceMaps: false,
      turbopackFileSystemCacheForBuild: env.BUILD_TURBO_CACHE === '1',
      turbopackRustReactCompiler: env.BUILD_RUST_RC !== '0',
      optimizePackageImports: [
        ...(config.experimental?.optimizePackageImports ?? []),
        '@hugeicons/core-free-icons',
      ],
      ...(capped ? { cpus, staticGenerationMaxConcurrency: cpus * 4 } : {}),
    },
  } as T
}
