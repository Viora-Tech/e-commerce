# Snapmint sandbox works from localhost (shopper IP)

Snapmint's create-checkout call needs the shopper's IP. On localhost there is no proxy header, so `clientIp` answers 'unknown' and every local Snapmint checkout failed with "Snapmint needs the shopper's IP address". `packages/payments-snapmint/src/cart.ts` now uses 127.0.0.1 only when `NODE_ENV === 'development'`; everywhere else a missing IP is still refused.

Next blocker seen in the local sandbox test (23 Nov): `POST /api/pub/carts` answers 403. Snapmint only accepts that call from allow-listed server IPs, so the tester's public IP must be allow-listed by Snapmint (owner asked them).
