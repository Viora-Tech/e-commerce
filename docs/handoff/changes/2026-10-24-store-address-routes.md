# Store addresses get their route automatically

- Bug: a new store's address (`<slug>.koomerce.app`) only got its Traefik/Dokploy route when the **admin** had the `DOKPLOY_*` keys, but those keys live on the worker, so production never asked and store addresses answered "404 page not found" (only hand-added ones worked).
- Signup now always asks; the worker's route job still does nothing without its Dokploy keys.
- Backfill: migration `0162_platform_routes` adds `stores_with_unrouted_platform_domains()`, and the worker's domain poll queues a route for every store address with `route_status = none` (once).
- Needs the worker env `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_STOREFRONT_APPLICATION_ID` set in production.
