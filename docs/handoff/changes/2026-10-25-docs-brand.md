# Docs match the landing page (2026-10-25)

The docs site (apps/docs) was still themed off the admin (blue accent, DM Sans + Bricolage, a placeholder tick logo, a "Waimers Commerce Docs" favicon). It now matches koomerce.app:

- Koomerce "K" mark in the navbar (`components/logo-mark.tsx`) and as the favicon (`app/icon.svg`, same file as apps/www).
- Plus Jakarta Sans for text and headings (`app/layout.tsx`).
- Neutral black/white/grey tokens with the brand orange as the one accent (`app/globals.css`, Nextra `primaryColor`), near-black `#0a0a0a` dark background.
- Dark by default, like the site; the light/dark toggle stays.
