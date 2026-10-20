# Check pass fixes after the 20 Oct parallel PRs

Branch `chore/dev-check-fixes`. The 20 Oct PRs (#597-#604) skipped lint and build to go fast; this
is the cleanup from one full `bun run lint` + `turbo run typecheck --continue` on dev.

- `group-input.tsx`: the drag-reorder `flatMap` inferred `unknown[]`; rows are picked explicitly.
- Biome formatting / import order in six files from those PRs.
- `themed-rerender.ts`: the reload flag cookie carries a `biome-ignore` for `noDocumentCookie`
  with the reason, as other first-party cookies in the admin do.
