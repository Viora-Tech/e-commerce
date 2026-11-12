# Hono product page: buy box island, store switch, side by side with Next (12 Nov 2026)

Branch `feat/storefront-hono-island`, draft PR into `dev`. Builds on the pilot
(`2026-11-11-storefront-hono-pilot.md`, its commit is the first one here). Ships **switched off**:
no store changes until the runbook is followed. Details, numbers and the runbook:
`docs/research/2026-11-storefront-hono-pilot.md` ("Update 12 Nov" and "Rollout runbook").

- **Owner decisions applied:** the buy box is the React `ProductView` hydrated as an island (no
  rewrite); Hono runs beside Next, switched on store by store, Next draws any page Hono cannot.
- **Island** (`apps/storefront-hono/src/island/`): `buy-box.tsx` is the tree Next draws for
  `MainProduct` (plus the Reviews widget and carousel through `LiquidAppBlock`), rendered on the
  server and hydrated by `client.ts` from JSON props (`props.ts`, refuses values JSON would change).
  `place.ts` puts it where the section's mark was. `actions.ts` replaces the three server actions in
  the browser bundle with JSON posts to `/theme-actions/island-*`, answered by the same actions on
  Next (`apps/storefront/src/lib/hono-island/actions.ts`). `scripts/build-island.ts` bundles it
  (`bun run build:island`; `start` runs it) and compiles the storefront's `globals.css`, which the
  pilot never linked (its buy box would have been unstyled). Up front: 163 KB gzip of JS against
  Next's 410 KB.
- **Switch:** `preferences.delivery.honoProduct` (default off, no migration). Owner-only card
  Online store › Preferences › Faster product pages (beta) (`hono-product-card.tsx`, English and
  Hindi `data/hi/hono-product.ts`); it saves through `store.updatePreferences`, which keeps the
  switch as stored for anyone who is not the owner (`keepOwnerOnlyPreferences`).
  Deployment-wide: `STOREFRONT_HONO_URL` (unset = off) and `STOREFRONT_HONO_TIMEOUT_MS`
  (default 3000).
- **Owner's preview in one browser:** the card's "Try it in this browser first" opens
  `/?hono=<token>` (signed by `honoPreview.token`, owner only, one hour,
  `@commerce/core/hono-preview`); the proxy sets `wc_hono=on` for that browser, which then gets Hono
  product pages while the switch is off. Unsigned, foreign or expired tokens change nothing.
  `?hono=off` opts any browser out, `?hono=clear` follows the switch again.
- **Routing:** `proxy.ts` asks `lib/hono-island/route.ts` (`wantsHono`) and rewrites
  `/products/<handle>` to `/-x/<store>/products/<handle>` (`app/-x/.../route.ts`, forbidden from
  outside like `/-h`). That route fetches the service with signed headers (`x-hono-forward`, HMAC
  of store, host and nonce) and hands anything but a 200 Hono page back to the Next page through
  the plain path's `forwardToReactPage`, with `x-hono-fallback: <reason>`. A breaker
  (`lib/hono-island/state.ts`) rests the service 30 s after five failures in a row.
  `/api/hono-island/<file>` serves the island's files from the service on the store's origin.
- **Service changes** (`apps/storefront-hono`): trusts only signed forwards in production
  (`STOREFRONT_HONO_DIRECT=1` to allow direct requests), uses Next's nonce and leaves the CSP to
  Next, answers 500 on any throw, and now skips what Next's product page draws differently: A/B
  theme tests, app embeds, unknown app block slots, a theme buy button with a pre-order note. It
  also draws the Inbox chat, Chatwoot and the market banner like the plain HTML path, and wraps the
  buy box in the store's price format (`MoneyFormatProvider`), which the pilot left out.
- **Deploy pieces (not deployed):** `apps/storefront-hono/Dockerfile` (no `next build`; one
  `bun install`, the island build, Bun runs the TypeScript) and a `storefront-hono` service under
  the compose profile `hono` (internal network, 768 MB). Releases build and deploy it with the
  others (`deploy/codebuild`: built once the ECR repo `vextro/storefront-hono` exists, deployed
  before the storefront once SSM `/vextro/deploy/dokploy-app-id-storefront-hono` is set; skipped
  until then).
- **Tests:** `apps/storefront/src/lib/hono-island/route.test.ts` (switch and path, the cookie
  preview and `?hono=` link, signature, fallback verdict, breaker, same-origin check),
  `packages/core/src/online-store/hono-preview.test.ts` (preview token, owner-only save), `apps/storefront-hono/src/island/island.test.ts`
  (props serialisation, placement), `packages/core/src/online-store/preferences.test.ts` (switch
  default and save).
- **Measured** (B direct, same method as the pilot): cached p50 52 ms, 365 req/s at 20 users,
  297 → 497 MB; uncached 16 req/s. HTML match against the production image: 504 / 504 sections,
  72 / 72 head SEO.
- **Not done here:** the end-to-end run through Next (no room for `next build` on the PC; there
  is no test server, so it is the owner's preview on production, runbook step 4); trimming
  `sanitize-html` out of the island bundle (later).
