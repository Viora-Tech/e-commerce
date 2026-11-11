# Order action matrix: audit and fixes (11 Nov 2026)

Audit: `docs/audits/2026-11-11-order-action-matrix.md` (every order action × every place, with
four open owner questions). Fixes #1532, #1533, #1534, #1535.

- **COD menus** (#1532): `nextOrderMove` (`apps/admin/src/lib/order-next-move.ts`) takes
  `{ cod, held, canPack }`. Cash on delivery packs and hands over first, then Mark as paid; a held
  order or a member without Orders: fulfil gets no packing move.
- **Row menu = order page** (#1533): `listCancelsShipment` offers Cancel shipment only for a live
  courier label (the list returns `labelLive`, `order.service.ts`); Create shipment hides on held
  orders and without Orders: fulfil. The order page gates Mark as unfulfilled / not delivered on
  the same grants as the row.
- **Packing grant** (#1534): `orders.setStatus` `fulfilled` / `delivered` need Orders: fulfil.
- **Drifted order unstuck** (#1535): `undoPacked` also puts lines that read packed back in step
  with their parcels (no stock moves); `orderUndos` offers Mark as unfulfilled when lines read
  packed under an Unfulfilled status (`packedUnits`).
- **Tests**: `packages/core/src/order/action-matrix.test.ts` (15 chained scenarios with books
  invariants), `order-next-move.test.ts`, a permissions test.

Overlaps PR #1513 in `order-view.tsx` (three prop lines); whichever merges second rebases.
