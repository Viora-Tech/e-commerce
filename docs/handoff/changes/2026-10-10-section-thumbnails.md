# Real section pictures in the Add panel

Branch `feat/section-thumbnails`.

- Add panel tiles (Figma 369:4918: 10px caption, 8 × 5.5 rem tile, border turns primary with a
  "+ Add" pill on hover or focus) and the hover card now show a picture of the section, drawn
  with its default settings and the default theme, light and dark by the admin's mode.
- `apps/admin/scripts/section-previews/` (`bun run section-previews` in apps/admin): renders every
  addable section through `@commerce/blocks` with stand-in products, collections and posts,
  styled by the storefront's own Tailwind build, and photographs each one in local Chrome via
  puppeteer-core. Writes `public/section-previews/<Type>.webp` and `<Type>-dark.webp` (512 px wide,
  ≤ 40 KB, 444 KB for all 86 files) and the generated list `src/lib/section-previews.ts`.
- 43 of the addable types have pictures. Layout and Elements blocks and five sections that draw
  nothing without a store (Featured carousel, Drop reveal, Reviews, Rich text, Logo list) keep the
  drawn glyph.
- New admin dev dependencies: `puppeteer-core` (Apache-2.0, uses the installed Chrome),
  `postcss` (pinned to the version `@tailwindcss/postcss` uses), `@types/bun` (for the script's
  own tsconfig).
- Test (not run, per the owner's rule): `src/lib/section-previews.test.ts` checks that every
  listed type has both files, each ≤ 40 KB, and that only addable types are listed.
- Docs: developer docs Theme editor → "Section pictures in the Add panel".
