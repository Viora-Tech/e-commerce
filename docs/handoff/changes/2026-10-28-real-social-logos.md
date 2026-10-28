# Real Facebook, Instagram, WhatsApp, YouTube and Google logos

Owner: "use real logo anywhere in the app like for fb, insta and whatsapp". The admin drew these
with Hugeicons' outline glyphs (one colour, the old Facebook "f" square). `@commerce/ui/icons`
now exports the real marks from `packages/ui/src/brand/social-logos.tsx`, in brand colours:
Facebook's round "f" (#0866FF), Instagram's glyph in its gradient, WhatsApp's bubble (#25D366),
YouTube's play button (#FF0000), Google's four-colour "G". Same names and props as before
(`size`, className; stroke and weight ignored), so every place updates at once: Growth sources and
channels, Home's channel menu, sales channels (Social media, channel logos), customer WhatsApp
actions, campaigns, contact actions, and the marketing site's WhatsApp tiles (which imported the
old `WhatsappLogo_` alias; now `WhatsappLogo`).

Paths come from Simple Icons 16.33.0 (already a dependency of apps/www; CC0), copied by script,
not redrawn; credited in THIRD_PARTY_NOTICES.md. Checked in the local admin (Growth → Sales by
source: Google, Instagram, WhatsApp in colour).
