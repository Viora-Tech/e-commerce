# Admin dark mode: neutral "zinc" dark after CodeHelp's web app

The owner (2026-10-14): CodeHelp's web dark mode "looks way better… exceptionally good for the eyes";
he wants the same feel. The reference tokens are in ch-frontend `apps/web/src/app/(frontend)/globals.css` `.dark`.

**Changes (dark only; light untouched):**
- **Surfaces** (`packages/ui/src/styles.css` `.dark`): neutral, no blue tint. Page `#0f0f0f`, sidebar `#131213`,
  cards `#09090b`, popovers and raised `#18181b`.
- **Borders:** solid zinc `#27272a` (strong `#3f3f46`) instead of white-alpha hairlines. Cards are flat with a 1px ring.
- **Text:** `#fcfcfc`, with `#a1a1aa` for secondary.
- **Key buttons:** white with dark ink for every accent (`darkKey()` now returns the white key). Active nav pills
  and soft fills are neutral `#27272a`.
- **Accent:** the merchant's accent stays in links, focus rings, charts and selection.
- **Status colours:** the Tailwind-400 family (green/amber/red/blue) on low-alpha fills.
- `designVars(…, 'dark')` writes the neutral values, so picked accents get the same look.
- Accent tests are updated (they pin the stylesheet).
- Developer docs: "Admin design system", the dark sections are rewritten.
