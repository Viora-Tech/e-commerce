# Analytics → Reports home: ask box and saved reports

Branch `feat/reports-home`. **Migration 0107_saved_reports** (table `saved_report`; ends with
`apply_store_rls()`).

- Reports home per Figma "Marketing / Reports home" (`reports-home.tsx`): the ask box (Home's
  `AskAiCard`, now taking a page's placeholder/chips/note) sends the question to the AI bar
  (`openAssistant`); with AI off it leads to Settings → AI. Then Saved reports
  (`saved-report-card.tsx`, ⋯ Rename / Delete) and Templates (the catalogue by topic).
- Report page: **Save report** (`report-name-dialog.tsx`) stores the report slug and the range.
- API `analytics.savedReports / saveReport / renameSavedReport / deleteSavedReport`
  (`saved-reports.service.ts`); store-wide, `created_by` kept. Test written, not run:
  `packages/api/test/saved-reports.test.ts`.
- Removed the old `reports-list.tsx` and `report-query-bar.tsx` (search box). "New blank report"
  and schedules from the Figma are not built (no report builder or scheduler yet).
- Docs: new merchant guide page `selling/reports.mdx`.
