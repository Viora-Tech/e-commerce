# Store emails: logo from imported themes, product photos, plainer layout

**Logo missing (root cause).** `storeEmailBrand` read only `theme.brand.logo` of the live theme.
An imported Shopify (Liquid) theme, like Waimers' revamp theme published 6 Nov, keeps its logo in
its own settings (Theme settings → Logo, `settings_data.json` `logo` / `logo_dark`, or a
header-group section setting), so `theme.brand.logo` is empty and every email showed the colour
dot and the store name instead. New `notifications/email-logo.ts` (`storeEmailLogo`): the imported
theme's logo first (same picker as the Inbox chat avatar, `liquidThemeLogoUrl`: the plain logo,
else a variant such as the dark one), then our theme's brand logo, then the checkout branding
logo. Root-relative paths are put on the store's primary domain; protocol-relative get `https:`.

**Blank product thumbnails.** The order email took the product's media at `position = 0` exactly
and did not check the media type. `notifications/email-images.ts` (`productCoverImages`) now takes
the lowest-position picture (no videos); the variant image is also limited to pictures. (Not
checked against live data: if #2430's line still shows a blank box after this, look at that
product's gallery rows.)

**Plainer layout.** The coloured hero banner (uppercase title, amount or photo card) is gone: logo,
a small grey context line ("Order #42"), one heading and line, the button, then the order. Sign-in
and confirmation codes show in the existing code box. `heroTitles` copy removed.

**Copy.** Dropped filler and salesy lines ("Still thinking it over?", "Good news:", "We hope you
love it", "Get it before it sells out", "Someone, hopefully you", "Not keen on these emails?").
All template variables are unchanged.

Tests: `email-logo.test.ts` (imported theme, checkout fallback, relative path), a thumbnail case in
`deliver.test.ts`; `packages/notifications` tests pass.
