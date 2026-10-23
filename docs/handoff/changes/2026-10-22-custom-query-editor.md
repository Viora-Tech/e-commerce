# Custom query editor, closer to ShopifyQL

Analytics → Reports → Custom query (`components/analytics/query/`).

## Editor
- Live validation: the text is parsed 250 ms after typing stops; the header shows "Valid query" or
  the error with its line and suggestion (error line underlined). A valid query that differs from
  the last run (spacing, case and comments ignored) runs on its own; answers to older runs are
  dropped (`use-query-runner.ts`). Run (⌘↵) always runs.
- Undo / redo (buttons, ⌘Z, ⌘⇧Z, Ctrl+Y) over typing (bursts merge), control edits, Format and AI
  answers (`use-query-history.ts`). Collapse / expand, and a "?" popover with the language and shortcuts.
- Date range (the Reports range picker) and Compare pills read and write SINCE / UNTIL / COMPARE TO.

## Controls panel
Right panel tabs: Controls (table, metrics, dimension, sort, limit) and the data reference. Every
control edits the parsed query through `@commerce/core/analytics-query` `controls.ts` and formats it
back, so it only writes queries the parser accepts. While the text does not parse the controls show
the last good query greyed with "Fix the query to use controls".

## Results
Bar / Line / Table, an "Items shown" stepper for the chart (top N rows), every row in the table.

## Save as report
`saved_report.query` (migration `0147_saved_report_query`). Saved custom queries use report slug
`query`, show under Saved reports and open `/analytics/reports/query?saved=<id>`. Rename, unsaved
changes bar (Discard / Save), Save as new, Delete. New procedures `analytics.getSavedReport`,
`analytics.updateSavedQuery`; `saveReport` takes `query`. Query text is parsed before it is saved.

## Refine with AI
`analytics.refineQuery` (ANALYTICS_READ, detached): the request, the language reference
(`queryLanguageReference`) and the current query go to the model under the assistant's switch,
rate limit and allowance (`startAiCall(context, 'assistant')`). The answer is query text only,
parsed on the server with one retry carrying the parse error; the editor then runs it through the
normal fixed-SQL runner. Hidden when the platform has no AI, explained when the assistant is off.
Prompt: `packages/ai/src/query-writer.ts`; the mock model answers it offline.
