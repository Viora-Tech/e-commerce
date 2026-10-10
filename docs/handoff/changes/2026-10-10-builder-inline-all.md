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
  allow-list gained h2 to h4, blockquote, hr and img (http(s) or root-relative `src` only) for the
  long-form fields (`inlineRichtextLong`). No copy is lost: Lexical images become `<img>`, YouTube
  embeds become a link to the video. The admin passes `@tiptap/extension-image` (new admin
  dependency, MIT, credited) as `richtextExtensions`, so pictures survive editing in Rich text/Text.
- Local DB on 2026-10-10: 0 of 9 `theme_template` rows (3 themes) and 0 saved My sections hold
  Lexical JSON, so 0 image or YouTube nodes; the converter is for older/other stores' data.
- Stored prop keys are unchanged. Tests: `test/library-inline.test.tsx`,
  `test/lexical-html.test.ts`, `apps/admin/src/lib/customize-doc.test.ts`.
- Docs: theme-editor.mdx "Inline editing" and "One rich-text store".
- FAQ and FAQ accordion show every answer open on the Customize canvas (`framed` now passes
  `editing` to a section body), since Puck takes clicks on the canvas and a closed answer could
  not be reached to edit.
- Checked in headless Chrome on a duplicate of the Waimers theme (deleted afterwards): one Puck
  mount cycle with a slow apps response (dev had a second remount), 14 inline edits across Hero,
  Image with text, FAQ, Testimonials, Multicolumn, Rich text, Tabs, Accordion and Button all kept
  after reload, and a seeded Lexical Rich text block drew as HTML and saved back as HTML.
