# Automations app: admin UI (workflows, templates, editor, runs, approvals)

Branch `feat/automations-ui`, built against the Automations contract (2a503b6f).

- Pages under `/apps/automations/…` (registered in `apps/admin/src/apps/registry.ts`):
  Workflows (`''`), Templates, Runs, Needs approval, Settings, `workflows/[id]` (editor) and
  `runs/[id]` (run detail). The editor is a "full page" (`AdminApp.fullPages`): drawn without
  the app header and tabs, like Shopify Flow's editor. The sidebar lists the app under Apps.
- Editor: vertical canvas (trigger, steps, Then/Otherwise columns), + on every edge opens a
  searchable step picker (plan-locked / asks-first / sensitive / messages-customers badges),
  condition builder (field → operator → value, All/Any, one nested group, line-item quantifier),
  action forms drawn from each action's `FieldSpec`, inline issues (`definitionIssues` + client
  piece checks), draft autosave (only valid drafts: the API's `draft` uses the full schema),
  publish with typed confirm for sensitive steps, Test with a record, version history.
- Copy: `data/automations.ts` + `data/hi/automations.ts` (catalogue copy keys word for word).
- `lib/automation-dev-mock.ts`: DEV ONLY stand-in used when a procedure answers
  NOT_IMPLEMENTED outside production. Delete once the engine's handlers land.
