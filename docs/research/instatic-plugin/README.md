# Koomerce plugin for Instatic (evaluation code)

This is the code behind [the Instatic evaluation](../2026-11-instatic-evaluation.md). It is
**not** part of the product. Nothing in the monorepo imports it.

## What is here

| Path | What it is |
|---|---|
| `shop/instatic-plugin.config.ts` | The plugin manifest (`koomerce.shop`). It asks for `loops.register`, `modules.register` and `frontend.assets` |
| `shop/server/index.ts` | Two loop sources: `koomerce.shop.products` is baked at publish; `koomerce.shop.products-live` is request-dependent, so it becomes a hole |
| `shop/modules/add-to-cart.ts` | Add-to-cart button. Posts `{items:[{id,quantity}]}` to `/cart/add.js`, then reads `/cart.js` |
| `shop/modules/cart-count.ts` | Header cart link with a live count from `/cart.js` |
| `shop/fixtures/products.json` | 8 Waimers products, taken from their product JSON-LD. Stock and compare-at prices were edited by hand |
| `landing/landing.html` | The landing page (hero, product grid, live grid, FAQ) as clean HTML |
| `landing/build-page.ts` | Imports the HTML with Instatic's importer, swaps in the plugin modules, saves and publishes |
| `scripts/koomerce-front.ts` | Stand-in storefront edge on :4100: answers `/cart/add.js` and `/cart.js`, passes everything else to Instatic |
| `scripts/e2e-cart.ts`, `scripts/editor-shot.ts` | Chrome checks (cart flow, editor screenshot) |
| `scripts/make-fixture.ts`, `scripts/zip.ts` | Builds the fixture; zips `dist/` (the CLI needs a `zip` binary, which Windows does not have) |

## Run it again

The SDK is not on npm, so the plugin must sit inside an Instatic checkout.

1. Get Instatic running:

   ```sh
   git clone https://github.com/CoreBunch/Instatic instatic && cd instatic && bun install
   bun run dev    # SQLite; API on :3001, editor on :5173
   ```

2. Copy this folder in:

   ```sh
   mkdir .eval-plugins
   cp -r <this folder>/shop <this folder>/landing <this folder>/scripts/*.ts .eval-plugins/
   ```

3. Build the plugin and zip it:

   ```sh
   cd .eval-plugins/shop && bun ../../src/core/plugin-sdk/cli/index.ts build && cd ..
   bun zip.ts shop/dist koomerce.shop.plugin.zip
   ```

4. Create the owner account and install the zip. Use either way:
   - in the admin (Plugins › Upload);
   - or with `POST /admin/api/cms/setup`, then `POST /admin/api/cms/plugins/package` (multipart:
     `file` and `grantedPermissions`), after a step-up at `/admin/api/cms/auth/step-up`.

5. Build the page, start the stand-in edge and check the cart:

   ```sh
   bun .eval-plugins/landing/build-page.ts
   bun .eval-plugins/koomerce-front.ts      # http://localhost:4100
   bun .eval-plugins/e2e-cart.ts
   ```

`build-page.ts` and the e2e script use the owner `eval@koomerce.test`. This is a local test
account only.
