# Admin redesign: Settings (first pass)

Branch `feat/proofly-settings`. Figma `YmMNC5JOimqg61sI0eFI5a` (Store details `349:3666`).

- New generic pieces in `components/settings/`: `SettingsRow` (label + help left, control right, hairline
  dividers), `SettingsCard`, `SettingsTextRow`, `SettingsPageHeader` ("< Settings" crumb, Bricolage title,
  plain subtitle, Save dimmed until dirty).
- Settings layout: text-only nav (soft blue active fill, muted group headings) beside one content column.
- Store details rebuilt on the new rows; header Save plus the existing floating Save bar with Discard.
- Settings pages that had a plain header (overview, checkout, customer accounts, privacy, policies, returns,
  AI, GST and invoices, account, appearance) now use `SettingsPageHeader`.
- No new strings, so no new Hindi overlays.

Not done: the other pages' card bodies still use the older card layout (rows not converted); header Save
is wired only on Store details; Policy "Generate with AI" and AI access (MCP) page skipped (no backend checked);
no browser check (no login available).
