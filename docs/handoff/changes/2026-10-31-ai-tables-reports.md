# AI answers: tables, charts and "Open as report" (#192, #102)

## What changed

- **Tables in answers (#192).** Read tools now return a `table` next to their `facts`
  (`packages/api/src/services/ai/answer-table.ts`): columns with a report column kind, rows of raw
  values (paise, counts, ISO days), an optional chart (line over days/months, or bars by category).
  - `salesSummary`: sales per day (per month past 62 days), empty days at zero, as a line.
  - `topProducts`: product, units, gross sales, as bars.
  - `lowStock`, `pendingOrders`, `findProducts`, `listCollections`: tables only.
- **The model never sees or writes the rows.** `assistant.ts` wraps every read tool
  (`keepingTables`): `detachTable` takes `table` off the output, leaves the facts, a one-line note
  and a `ref`; the `source` event carries the table straight from the tool. Titles in rows go
  through `safeTitle` (the same guard and taint as facts).
- **"Show query".** Each `source` event also carries `inputs` (the tool's inputs, flattened to short
  text). The panel shows "Looked up top products · Period: this month · How many: 5" under a
  "Show query" toggle, next to "Data used".
- **Panel UI.** `answer-table-card.tsx` (compact table, scrolls past ~8 rows) and `answer-chart.tsx`
  (small recharts line/bar on the shared chart pieces and `--chart-1`).
- **Open as report (#102).** Tables that fit a custom query carry it (`salesSeriesQuery`,
  `topProductsQuery`, only for stores on `Asia/Kolkata`, since the query engine runs in IST) and
  open live in the query editor via `?q=`; Save there is the normal saved-query flow. Any other
  table opens `/analytics/reports/answer` as a **snapshot** (handed over in sessionStorage), which
  says the numbers do not update. Save report files it as `report_slug = 'answer'` with the
  snapshot JSON in `saved_report.query` (validated by `AnswerSnapshotSchema` in the router and
  re-validated on read by `parseSnapshot`). No migration.
- **Reports page ask box answers on the page.** `reports-ask.tsx` runs its own in-memory
  conversation (`useAssistant(null, { persist: false })`) and renders the turns (answer, tables,
  change cards) under the box. `AskAiCard` takes an optional `onAsk`.

## Not done

- Snapshots do not re-run; there is no "refresh" for a saved answer.
- `abandonedCheckouts`, `productDetails`, `orderDetails` return facts only (no table).
- No checks were run (owner rule). Pure tests: `packages/api/test/ai-answer-table.test.ts`,
  `apps/admin/src/lib/answer-report.test.ts`.

## How to test

1. Ask the AI bar "Sales this month?": a line chart and a daily table under the answer; "Show
   query" lists Period: this month. "Open as report" opens the query editor with
   `GROUP BY day … COMPARE TO previous_period`; Save works as for any query.
2. "Top products this month": bars + table → opens as a products query.
3. "What is running out?": table, the note says it opens as a snapshot → snapshot page with the
   note, Save report → appears under Saved reports, opens again from its card.
4. Reports page: ask in the box; the answer appears on the page, the side panel stays closed.
