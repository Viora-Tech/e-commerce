# RapidShyp delivery dates read as DD-MM-YYYY (#1432)

**Bug.** Delivery options showed every RapidShyp route with the same "(estimate)" date. RapidShyp
sends `edd` as DD-MM-YYYY ("22-04-2026", per its serviceability docs); the adapter only parsed
YYYY-MM-DD, so each date was dropped and the store's default transit days were used instead.

**Fix.** `eddDaysFromToday` (exported, packages/shipping-rapidshyp/src/rapidshyp.ts) reads
DD-MM-YYYY, YYYY-MM-DD (with / or . too, and a trailing time), rejects impossible dates (31-02),
and counts days on India's calendar instead of from the current UTC instant. Test fixtures now
build their dates on India's calendar in RapidShyp's format.

**Checks.** shipping-rapidshyp: 36 tests pass (the 3 new date tests failed before the fix);
typecheck and Biome clean.

**After deploy.** Delivery options → Try a PIN should show per-courier dates for RapidShyp
routes without "(estimate)".
