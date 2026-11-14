# Collection edits change only what they send (#1186); cookie banner shown / answered; Cookie settings link in imported footers

Branch `fix/collections-cookies`. No migration.

## Collections (#1186)

- `collections.update` now takes `CollectionPatchSchema` (`CollectionWriteSchema.partial()`,
  `packages/core/src/collections/schemas.ts`). Every field may be left out; a left-out field keeps
  its saved value, `null` clears description, image, SEO and template. Title and kind are no longer
  required on an edit, so an MCP `runAction collections.update { id, write: { imageMediaId } }`
  touches only the image.
- `updateCollection` (`packages/core/src/collections/service.ts`) reads the row first and checks
  the collection as it will be after the save (kind and rules merged), re-syncs an automatic
  collection on any save, and writes manual members only when `productIds` is sent.
- The admin form (`components/collections/form-state.ts` `toWrite`) still sends every field, so it
  is unchanged. `createCollection` still takes the full `CollectionWrite`.
- MCP action docs regenerated (`collections.update` now has its one-line description).

## Cookie banner shown count

Already built in #1196: `POST /api/consent-shown` (once per tab via sessionStorage, no cookie, no
IP kept) adds one to `cookie_banner_day.shown` for the store and day. It was shown in Settings →
Customer privacy as a separate sentence. Now one line reads shown / answered / allowed analytics /
allowed marketing / left unanswered (`customerPrivacyContent.banner.stats`). Customer privacy has
no Hindi overlay yet (whole page), so no Hindi was added.

## Cookie settings link

- Zero Drift footer block: new `showCookieSettings` setting (Show by default; old saved footers keep
  the link).
- Imported (Liquid) themes: `renderLiquidSections` adds "Cookie settings" (`#cookie-settings`) to
  the `footer` section's policy list (`ul[class*=polic]`, copying the first link's class), or as a
  line before `</footer>` when there is no list. Added after the render cache, so it reaches cached
  footers at once and Customize changes show at once. Customize shows a "Cookie settings link"
  Show / Hide field on imported footer sections (`platformSectionFields` in core,
  `_cookieSettingsLink` prop); not set means Show. A footer that already links to
  `#cookie-settings` is left alone. The theme's own `cookie-banner.js` and our ConsentManager both
  open on that hash.
- Zero Drift cookie banner default message says "you can change this any time from Cookie
  settings at the bottom of the page".
- Waimers' live banner text is theme data (Customize → Cookie banner → Message on `Glide - revamp`),
  not code; add the sentence there after this ships.
- Nothing about discounts or WELCOME100 depends on cookie answers.
