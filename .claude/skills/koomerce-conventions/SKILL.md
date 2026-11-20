---
name: koomerce-conventions
description: The enforced code conventions of the Koomerce commerce monorepo. Use before writing or reviewing any React component, admin page, copy text or styling in apps/admin, apps/storefront, packages/blocks, packages/editor or packages/ui; covers the one-component file structure, copy in data/*.ts with the Hindi overlay, rem sizes, Tailwind only, the 500-line cap and the lint:components checker.
metadata:
  checked-against: "dev, 20 Nov 2026"
---

# Koomerce code conventions

Source of truth: `docs/conventions.md` (read it for anything not covered here) and `CLAUDE.md`.
The checker is `scripts/check-components.ts`, run by `bun run lint:components` (and as part of
`bun run lint`).

## Before you start

- Find code with `bun run code-map <folder or words>` (for example `bun run code-map shipping`).
  It prints each file's purpose and exports, so you open only what you need.
- New feature? Check `docs/open-source-radar.md` first and credit anything adapted in
  `THIRD_PARTY_NOTICES.md` (permissive licences only).

## Component file structure

Every `.tsx` under `apps/*/src`, `packages/blocks/src`, `packages/editor/src` and
`packages/ui/src` (except vendored `packages/ui/src/components/shadcn/**`), in this order:

1. `'use client'` only when the file needs browser APIs, state or effects.
2. Imports.
3. `type XProps = { ... }`. Never `interface` (only `declare global { interface Window }`).
4. Pure helpers and constants at module scope.
5. Exactly one `export default function ComponentName()`. No named component exports. Small
   private sub-components may sit below it if not exported.
6. Body sections, each headed by its comment: `// Hooks`, `// Helpers`, `// Event handlers`
   (arrows named `handleX`), `// Early returns`, `// Render logic`, then one `return`.
7. No `useCallback`, `useMemo` or `React.memo`: the React Compiler memoises.
8. Soft cap 300 lines, hard cap 500. Split into sibling files rather than growing one.

Files are kebab-case and named after the component (`order-status-cell.tsx` default-exports
`OrderStatusCell`). The full example and the checker's messages are in
[reference.md](reference.md).

## Copy and languages

- Copy lives in `data/<feature>.ts` (for example `apps/admin/src/data/customize.ts`), never
  inline in a component.
- Admin components read it through `useCopy(x)` (client, `apps/admin/src/hooks/use-copy.ts`) or
  `await getCopy(x)` (server, `apps/admin/src/lib/copy-server.ts`) so it follows the member's
  language.
- Hindi overlays live in `apps/admin/src/data/hi/<feature>.ts`, built with `translation(...)`
  from `apps/admin/src/lib/i18n.ts` and spread into `apps/admin/src/data/hi/index.ts`. When a
  feature has a Hindi twin, the typecheck fails until every new English key is translated; use
  `untranslated` if you cannot write the Hindi. Wording rules: `docs/i18n-glossary.md`.
- Developer docs: `apps/docs/content/developer-docs/core-concepts/admin-languages.mdx`.
- No em or en dashes in user-facing strings.

## Styling

- Tailwind only. No handwritten CSS beyond `@theme` tokens, print styles and third-party
  overrides.
- Sizes in rem, never px, in code and in written reports.
- The one CSS exception is the storefront theme port in `packages/blocks/src/styles/`
  (`section-<name>.css`): still rem, colours from theme CSS variables.
- Motion and "smooth UI" rules (no `transition-all`, no backdrop blur on big fixed surfaces,
  named transition properties) are in `docs/conventions.md`, "Motion" and "Smooth UI".

## Server barrels in client code

A `'use client'` module must not value-import `@commerce/core` or `@commerce/db` (it pulls the
database driver into the browser and breaks the build). Import types only, or use a pure subpath
such as `@commerce/core/catalog`, `/permissions`, `/delivery-options`. The checker and the
`client-imports-server` sweep both enforce it.

## Check your work

```sh
bun run lint:components         # structure checker only
bun run check:changed --no-test # biome + tsc on what changed since origin/dev
```

On this machine, do not run full builds or more than one dev server (see the
`koomerce-testing` skill). Admin design frames and deviations: `docs/design/admin-frames.md`.
