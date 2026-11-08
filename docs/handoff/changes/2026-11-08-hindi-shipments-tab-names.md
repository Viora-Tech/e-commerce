# Admin: stale Hindi names for removed shipments links (2026-11-08)

- #1256 dropped the Ready to ship and Ready for pickup sidebar links but left their Hindi page
  names in `apps/admin/src/data/hi/navigation.ts` and the unused `routes.orders.shipmentsTab`
  helper. Both are gone, and the i18n "only name pages the admin really has" test passes (#1318).
