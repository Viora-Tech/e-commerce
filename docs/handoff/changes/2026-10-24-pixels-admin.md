# Pixels app, PR 5 of 5: manifest and admin screens

The admin half of the Pixels app. Design: `docs/superpowers/specs/2026-10-24-pixels-design.md` §6–7.

- Manifest `packages/core/src/pixels/app.ts` (`@commerce/core/pixels-app`, in `commerce.config.ts`): id
  `pixels`, builtin, category marketing, free (not in `APP_PRICING`), **`listing.unlisted: true`** until our
  own pixel has run a week on `dev` (design §8 rollout); flip it and run `bun scripts/gen-app-catalogue.ts`
  to list it. Pages `''` (Pixels) and `events` (Event log).
- Admin (`apps/admin/src/components/apps/pixels/`, registered in `apps/registry.ts`):
  - `pixels-page.tsx`: Add pixel, 7-day `StatStrip` (sent, purchases, failed, skipped for no consent),
    one card per pixel, empty state.
  - `pixel-card.tsx`: name + status chip (Browser + server / Browser only / Paused / Error), ID with copy,
    last event, token hint, test code, event checkboxes, Purchase select with the 7-day warning, the Error
    banner with Replace token; footer Send test event and Edit; `…` menu Pause/Resume, Remove token,
    Remove (confirm dialog).
  - `pixel-dialog.tsx` (add/edit, TikTok and Google shown disabled), `token-dialog.tsx`.
  - `event-log-page.tsx` + `log-columns.tsx` + `event-dialog.tsx`: view select All/Sent/Failed/Skipped,
    filters pixel/event/source, row dialog with event id, Meta's answer, fbtrace id, attempts, matched.
  - Copy `data/pixels.ts`, Hindi `data/hi/pixels.ts`.
- Online Store → Preferences: the Meta pixel field is replaced by a link, "Moved to the Pixels app".
- Merchant guide `apps/docs/content/merchant-guide/apps/pixels.mdx`.
