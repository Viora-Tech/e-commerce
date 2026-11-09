# `next build` in two processes: compile, then generate (8 Nov 2026)

Admin's build peak drops about 9%, from 5.35 to 4.86 GB, with the same output. Measured in
Docker with 2 CPUs: anonymous memory, sampled every 0.5 s.

## What changed
- Both apps' `build` script (and so `bun run build`, which the Dockerfiles call) is now
  `next build --experimental-build-mode=compile && next build --experimental-build-mode=generate`.
- Why: Turbopack holds its compile memory (about 3.5 GB for admin) until its process exits.
  Even after `project.shutdown()` and a forced GC, the memory stays held. In one `next build`, the
  page-data and page workers start on top of it. Split, `generate` starts in a fresh process
  that never loads Turbopack.
- Same output, checked by building admin both ways from the same tree. These match:
  - `routes-manifest`, `app-path-routes-manifest`, `app-paths-manifest`;
  - `required-server-files`, `images-manifest`, `middleware-manifest`,
    `functions-config-manifest`;
  - the `.next` and `.next/standalone` file lists.

  The only differences: the preview-mode keys, which are random on every build, and one
  server chunk name.
- `next build` on its own still works the same, for anyone who runs it directly.

## Risk
`--experimental-build-mode` is marked experimental in Next 16.4. If an upgrade breaks it, set
the `build` scripts back to `next build`. Nothing else depends on the split.
