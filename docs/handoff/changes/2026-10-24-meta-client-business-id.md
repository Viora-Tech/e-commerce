# Meta connect: business from client_business_id, named Graph steps

- The debug_token lookup (2026-10-24-meta-system-user-discovery) still failed on production with
  `(#100) Missing Permission`: it found no business and fell back to `/me/businesses`.
- `metaDiscover` now reads the business the way Facebook Login for Business documents it:
  `GET /me?fields=id,client_business_id` with the system user token. The business name is
  best-effort (`/{id}?fields=name`, falls back to the id).
- Each Graph step's error is prefixed with its name (`business`, `businesses`, `catalogs`,
  `create catalog`), so the admin log says which call Meta refused.
- Test fixed to import `vitest` (core's runner) and moved off `bun:test`, which broke core's tsc.
