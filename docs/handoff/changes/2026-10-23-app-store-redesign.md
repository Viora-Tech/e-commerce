# App Store site redesign

Branch `ui/app-store-redesign`. Owner feedback on PR #682's App Store pages: they looked like a
plain list. This redesigns `/apps`, `/apps/category/<slug>` and `/apps/<id>` on koomerce.app in
the site's own look (dark, monochrome, Plus Jakarta Sans, glass panels, orange only on Install).
No new dependencies; still a static export.

## Data

- `AppListing` (`packages/plugins/src/types.ts`) gains an optional `faq` (question and answer).
  The seven built-in apps (GST invoices, Reviews, Back in stock, EMI & pay later, Forms, Search &
  discovery, Shopify importer) now carry two to four questions each, written from their merchant
  guides. No ratings, install counts or reviews anywhere: there is no such data.
- The generated catalogue (`catalogue.generated.ts`, `bun scripts/gen-app-catalogue.ts`) also
  copies `faq` and the admin icon name (`admin.icon`), so our own apps draw the same glyph the
  admin sidebar uses. The `app-catalogue` sweep checks both, as before.
- `apps/www/src/data/apps.ts`: plain-word permissions (`accessSentence`: "Can see orders",
  "Can see and change payments"), price helpers (`priceChip` "₹149/month", `priceIncluded`,
  `priceRows` per plan), `appFaq` (the app's own questions, then price, the outside account a
  connection needs, what leaves the store, and removing it, all from catalogue data), and
  `appCollections` (the hand-picked "Essentials for Indian D2C" steps and "Built by Koomerce").

## /apps and category pages

- Hero: headline, a count taken from the catalogue, one large search field that filters as you
  type ("/" focuses it, Escape clears), and category chips. Chips link to each category's static
  page and carry the search over. On wide screens a wall of every app icon sits beside it.
- Unfiltered front page: "Essentials for Indian D2C" as the four steps an order takes (get paid,
  bill, ship, keep shoppers posted), a sideways row of our own apps, then a shelf per category
  (six apps and "See all"). Any search or filter turns the page into one grid of matches; nothing
  found shows suggested words and a clear button.
- App icons (`components/apps/app-tile.tsx`): company logos on a light plate; our apps a dark
  engraved tile with their admin glyph and a small K; anything else a monogram. No image can
  break (logos are sweep-checked).

## /apps/<id>

Breadcrumb, a large header (icon, name, tagline, maker, category, price) with Install (to the
admin's install flow, unchanged) and View docs. A glass Install bar follows once the header
scrolls away (top on desktop, bottom on phones). Then a drawing built from the listing in place
of screenshots: the app's pages inside an admin window with its highlights, what travels between
the store and the app's company (from `shares`), and the theme block it adds. Real screenshots,
when a listing has them, show above it. Then what it does, what it needs access to, a pricing
card with each plan, works with, details, questions (also as FAQ JSON-LD) and related apps.

## Not changed

Install URLs, metadata, OG images, sitemap and the JSON-LD for apps and lists.
