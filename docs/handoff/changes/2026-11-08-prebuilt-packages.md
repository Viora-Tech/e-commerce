# Prebuilt server-side packages for image builds (8 Nov 2026)

The admin and storefront image builds compile the server-side workspace packages to plain
JavaScript before `next build`, so Turbopack bundles small per-file JS instead of compiling about
7 MB of raw TypeScript. The aim is less `next build` memory: admin peaked at about 5.9 GB after
the lean build (#1284), and the goal is 4 GB without swap. Dev is unchanged.

## What changed
- `scripts/prebuild-packages.ts` (about 8 s, 52 packages, about 1,500 files):
  - Every `packages/*/src/**/*.ts` is compiled on its own with TypeScript 5.9's
    `transpileModule` (the root `typescript`, so no new dependency). Only types are stripped:
    `'use client'`/`'use server'`, comments (`webpackIgnore`), `process.env` and `import.meta`
    stay as written.
  - Output goes to `dist/` at the same depth as `src/`, so paths relative to a file still point
    at the same place (`../drizzle`, the invoice fonts, the seed JSON).
  - Relative imports get their real extension (`./a.js`, `./b/index.js`), so the output is valid
    ESM.
  - `.tsx` files and data files are copied unchanged, so Next still compiles JSX with the React
    Compiler (the plugins' Puck `blocks.tsx`, the invoice PDFs, the email templates).
  - `exports` that point into `./src/` are pointed at `./dist/`.
  - The script fails on a `.ts` hook (a `useX(` call in a file importing React or a client
    package), on a directive that did not stay at the top, and on an import it cannot resolve.
  - `--dry` compiles without touching package.json. `--revert` restores the exports and deletes
    `dist/`.
- Left as source (`KEEP_SOURCE`): `@commerce/ui`, `@commerce/blocks`, `@commerce/editor` and
  `@commerce/richtext`. They are client React code, and prebuilding them would take their hooks
  out of the React Compiler.
- `dropPrebuilt` (packages/config/src/lean-build.ts), applied to both apps' production config:
  it drops a package from `transpilePackages` only when its exports point at `dist/`, so a build
  without the script is unchanged.
- Both Dockerfiles: `ARG BUILD_PREBUILT=1`, copy the script from the pruner (turbo prune leaves
  out root files), then `RUN bun scripts/prebuild-packages.ts` before `next build`.
- Sweep `scripts/sweeps/prebuild-packages.test.ts` checks:
  - the export and import rewriting;
  - that no prebuilt package has a `'use client'` `.ts` file;
  - that `KEEP_SOURCE` is real;
  - that both Dockerfiles prebuild before `next build`.

## Switches
- `docker build --build-arg BUILD_PREBUILT=0 ...` builds every package from source, as before.
- Running the script by hand rewrites 52 package.json files. Run `bun scripts/prebuild-packages.ts
  --revert` afterwards, or use `--dry`.

## Checked
- All 260 rewritten export entries load with Bun from `dist/` and export the same names as from
  `src/`. Plain Node ESM imports `@commerce/money`, `core/gst`, `core/errors`, `invoices`,
  `plugin-reviews/settings` and others from `dist/` (a copied `.tsx` needs a bundler).
- The memory and time effect is not measured yet: it needs a Docker build. Compare a build with
  `BUILD_PREBUILT=0` and one with the default.

## Watch for
- Under Turbopack, `transpilePackages` hardly matters for workspace packages: their real path is
  outside node_modules, so they are compiled as app code either way. Any saving comes from
  handing Turbopack type-free per-file JS. If the measurement shows no gain, drop this change
  rather than keep it.
