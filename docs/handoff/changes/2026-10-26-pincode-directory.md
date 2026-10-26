# PIN code directory installed (City/State autofill at checkout)

Branch `feat/pincode-2026-10-26b`. No migration.

- `packages/shipping/data/pincode-directory.json.gz` (about 57 KB, 19,251 PIN codes, all 36
  states and union territories) is now in the repo. Before this the file was never built, so
  checkout's "PIN code first", the admin customer lookup, `placeOrder`'s PIN/state check and
  the India Post app all fell back to "no directory".
- Source: India Post's All India Pincode Directory on data.gov.in, release of 30 May 2019
  (`https://www.data.gov.in/sites/default/files/dataurl31052019/Pincode_30052019.csv`),
  Department of Posts, Government Open Data Licence - India. Credited in
  `THIRD_PARTY_NOTICES.md` and `packages/shipping/THIRD_PARTY_LICENSES.md`.
- The newer monthly resource ("All India Pincode Directory till last month", API resource
  `5c2f62fe-5afa-4119-a499-fec9d604d5bd`) needs a data.gov.in API key; the public sample key
  was rate-limited, so the 2019 file was used. The builder corrects what changed since:
  Ladakh (Leh, Kargil), the merged Dadra and Nagar Haveli and Daman and Diu, renamed
  districts (Gurugram, Prayagraj, Ayodhya, Nuh, Belagavi, Kalaburagi, Mysuru, Raigad).
- `scripts/build-pincode-directory.ts` now also: picks each district's state by majority (the
  source's state column has stray errors, e.g. Panvel offices under Uttar Pradesh, Chandigarh
  under Punjab), drops rows the PIN prefix table (`packages/core/src/checkout/pincode-state.ts`)
  rules out, so the directory never contradicts that check, and strips stray bytes from names.
- Docker: Next standalone tracing cannot see a file read by path, so `apps/storefront` and
  `apps/admin` `next.config.ts` add it via `outputFileTracingIncludes`; it lands at
  `/app/packages/shipping/data/` and the loader finds it from `apps/<app>` (`../..`). The
  worker image copies the full pruned source, which already includes it.
- Known data quirks: India Post districts are used as the city, so 110001 fills
  "Central Delhi" and Karnataka's Bijapur stays "Bijapur" (the name is shared with a
  Chhattisgarh district).

## Refresh

1. Download the newest CSV from https://www.data.gov.in/catalog/all-india-pincode-directory
   (with a data.gov.in API key: `https://api.data.gov.in/resource/5c2f62fe-5afa-4119-a499-fec9d604d5bd?api-key=<key>&format=csv&limit=all`)
   into an empty folder outside the repo.
2. `bun scripts/build-pincode-directory.ts <file.csv>` (it reads `pincode`, `district`,
   `statename` and, when present, `circlename` columns, either header style).
3. `cd packages/shipping && bunx vitest run test/pincode-directory.test.ts`, then update the
   release date and URL in `THIRD_PARTY_NOTICES.md` and `packages/shipping/THIRD_PARTY_LICENSES.md`.
