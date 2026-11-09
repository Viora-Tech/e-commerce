# Every admin page measured, and a script to measure them again

`docs/research/2026-11-admin-pages-perf.md` measures all 186 admin routes on a scaled copy of the
dev store (504 products, 2k customers, 5k orders) in `next dev`: server time, DB statements,
script size and errors per page, the 20 slowest, what each fix changed, and what is left. Raw
data sits next to it (`2026-11-admin-pages-perf-*.csv`).

- `scripts/perf/seed-scale.ts`: scales the seeded Waimers store up with bulk SQL (`--orders`,
  `--customers`, `--product-copies`; `--clean` removes exactly what it added; refuses a non-local
  database).
- `scripts/perf/admin-pages.ts`: signs in the seeded dev owner through the dev OTP route (the
  cookie is kept in the OS temp folder: sign-in codes are rate limited), opens every route in
  headless Chromium (dynamic segments filled from seeded rows) and counts the statements Postgres
  logged between two marker queries. Needs `log_statement = all` on a throwaway database in a
  Docker container.
- `scripts/perf/admin-pages-chunked.ts`: runs it a few pages at a time, restarting `next dev`
  between chunks and ending a chunk early under 1.5 GB of free memory (a dev server grows by about
  half a gigabyte per page it compiles). `--checkout` serves another worktree, for "before"
  numbers while this one has the fixes.
- `scripts/perf/admin-pages-report.ts`: Markdown tables from the CSVs.
- No app code here; the fixes are their own PRs (#1399 to #1403, #1405).
