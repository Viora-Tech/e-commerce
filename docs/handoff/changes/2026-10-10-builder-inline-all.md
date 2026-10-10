# Click any text to edit it, on every section

Branch `feat/builder-inline-all` (stacked on `fix/builder-editor-loads-once`). No migration.

- Inline editing now covers the generic sections, not only Zero Drift: every library and modern
  section (`packages/blocks/src/sections/library.tsx`, `modern.tsx`), Featured products,
  Collection grid and Rich text (`puck-config.tsx`), and the build-your-own blocks (Tabs labels,
  Accordion titles, Heading, Text, Button, Badge). Headings, eyebrows, captions, item titles and
  button labels are `inlineText`/`inlineTextarea`; body copy is `inlineRichtext`, drawn by `RichCopy`.
- `inlineLinkField` (`sections/framed.tsx`): `{ label, href }` with an inline label. Group and
  Image links keep `linkField` (their label is an aria-label only).
- Components render the nodes: keys no longer use copy in template literals, Video's iframe
  title only uses a string heading, Collection grid passes a string tab label (the handle while
  the heading is being edited).
- Lexical retired: `richTextField` and the `RichTextEditor` option of `createBlocksConfig` are
  gone. `packages/blocks/src/lexical-html.ts` converts stored Lexical JSON; `richtextHtml` reads
  it on the storefront and `normalizeDoc` / My-section insert convert it in Customize. The
  allow-list gained h2 to h4, blockquote and hr for the long-form fields (`inlineRichtextLong`).
  Images and YouTube nodes inside old Lexical copy are dropped by the converter.
- Stored prop keys are unchanged. Tests: `test/library-inline.test.tsx`,
  `test/lexical-html.test.ts`, `apps/admin/src/lib/customize-doc.test.ts`.
- Docs: theme-editor.mdx "Inline editing" and "One rich-text store".
- Not checked in a browser: the Chrome extension was not connected for this build.
