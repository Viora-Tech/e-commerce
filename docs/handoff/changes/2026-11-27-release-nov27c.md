# Release 27 Nov (c): eight branches in one dev → main release

Branch `release/nov27c` (from `origin/dev` 8be683b06). Migration `0272_founding_offer` (additive).

## What changed

Merged with `--no-ff`, in this order (each branch has its own handoff note of 27 Nov):

1. `perf/storefront-nov27`: one request per run of theme stylesheets, AVIF product preload,
   card image sizes, lighter video posters (`2026-11-27-storefront-speed.md`).
2. `fix/probe-overload`: bare 404 for scanner probes, one 404 render per theme version, render
   queue (`2026-11-27-probe-overload.md`).
3. `feat/track-order-signed-in`: Track order lists a signed-in shopper's recent orders.
4. `feat/invoice-template-polish`: the "Logo left" GST invoice template.
5. `feat/push-turn-off`: turn push off and remove push devices in Account → Notifications.
6. `feat/founding-offer`: founding merchant offer for the first 20 sign-ups (migration 0272).
7. `feat/affiliate-portal-domain`: connect `affiliate.<domain>` inside the Affiliates app.
8. `fix/rule-route-wins`: a rule's preferred courier wins on a Standard card.

Merge work:

- One conflict, `apps/storefront/src/lib/liquid-theme.ts` (`liquidLayoutFor`): kept probe-overload's
  `withRenderSlot(() => inStore(...))` wrapper and the perf branch's `bundleThemeStylesheets` +
  product `avifImagePreloads` head.
- `packages/api/src/mcp/action-docs.generated.ts` regenerated (`bun scripts/gen-mcp-action-docs.ts`).
- `packages/core/src/billing/founding-offer-service.test.ts` read `order.note`, which is not a
  column: the draft note lives in `order_note`, so the test reads it there.
- `apps/admin/src/components/apps/affiliates/portal-address-card.tsx`: permission checks moved into
  the effects so the component order rule passes (lint:components back to 223); copy key
  `useHelp` renamed `connectHelp` (biome read it as a hook).
- Journal: 0272 follows 0271 and its `when` (1796100000000) is later than every entry.

## Tests

- Typecheck clean: core, api, invoices, blocks, storefront, admin, worker.
- Vitest (`--maxWorkers=2`, `TEST_DB_NAMESPACE=rel27c`): core 479 files / 4428 tests, api 129/693,
  invoices 8/85, blocks 50/805, worker 15/99, storefront 124/957 (1 skipped), admin 244/1333; all pass.
- `bun run lint:components`: 223 errors (baseline). `bun run audit`: no direct high/critical.
- `bun run test:sweeps`: 17 files / 27 tests fail, the same set as on `origin/dev` 8be683b06.

## Left to do / for the owner to check

- Sweeps already red on dev gain offenders from this release: unused exports (`planPriceFor`,
  `PORTAL_SUBDOMAIN`, `primaryCustomDomain`, `portalHostnameFor`, `PORTRAIT_COPY`,
  `optionAllows`, `stripItems`, `mix`), SOURCE OF TRUTH header on `packages/core/src/domains/portal.ts`,
  server-only import in `apps/storefront/src/lib/render-gate.ts`, `liquid-theme.ts` (766 lines) and
  `proxy.ts` (627 lines) growth, `polish-style.ts` `initials`. Clean up with the dev sweep backlog.
