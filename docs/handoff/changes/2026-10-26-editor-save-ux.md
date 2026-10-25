# Theme editor: one clear Save, no surprise "Unsaved changes" (2026-10-26)

- Live theme: the commit button is **Save** (tooltip "Saving puts your changes on your live store"), not "Publish" — like Shopify. Draft themes keep Save + Publish.
- Opening the editor on a page with drafts from an earlier visit names them once: a toast "You have changes from your last visit — not on your store yet" with **Discard** (`leftoverDrafts` in `lib/customize-editor.ts`), instead of a silent "Unsaved changes" chip.
- English + Hindi copy (`bar.leftoverTitle`, `leftoverBody`, `saveLiveHint`).
- Lint on `dev`: Agentic get-ready switch labelled by `aria-labelledby` (no label without control); formatter fix in `storefront-cache.ts`.
