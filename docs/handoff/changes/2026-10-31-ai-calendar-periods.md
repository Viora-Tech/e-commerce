# AI: calendar periods for sales questions (audit #103)

- The store AI's `salesSummary` and `topProducts` tools used to take only "the last N days", so "this month" quietly became the last 30 days. They now take `period`: days, today, yesterday, this_week, last_week, this_month, last_month, this_year, or custom (`from`/`to`, both days included). Times use the store's time zone, and weeks start on Monday.
- The comparison window is the same length just before the period.
- Answers name the dates, e.g. "this month (1 Oct – 31 Oct)".
- Pure resolver: `packages/api/src/services/ai/periods.ts`. Tests: `packages/api/test/ai-periods.test.ts` (pure; runs with `bun test`).
