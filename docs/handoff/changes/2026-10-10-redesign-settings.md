# Admin redesign: Settings

Branch `feat/proofly-settings`, PR #308. Figma `YmMNC5JOimqg61sI0eFI5a` (Store details `349:3666`,
Overview `314:15638`, Taxes `350:16082`).

- Generic pieces in `components/settings/`: `SettingsRow` (label + help left, control right, hairline
  dividers), `SettingsToggleRow` (switch right), `SettingsTextRow`, `SettingsCard`, `SettingsPageHeader`
  ("< Settings" crumb or a parent `back`, Bricolage title, plain subtitle, Save dimmed until dirty).
- Settings layout: text-only nav with a soft blue active fill, one content column.
- Overview: Proofly checklist (progress chip, "Set up" buttons) and a two-column grid of every page.
- Rows adopted on Store details, Returns, Checkout (+ COD rules), Customer accounts (+ sign-in providers
  and extras), Privacy, Policies (+ editor), AI, Taxes (registration, charging, numbering), Appearance.
- Every settings card now uses `SettingsCard`; every settings header uses `SettingsPageHeader`
  (detail pages pass `back`). Header Save is wired on Store details, Returns, Checkout, Customer accounts,
  Privacy, Policies and AI (floating Save bar with Discard stays everywhere).
- WhatsApp help is gone from settings pages: the shared `HelpFooter` is a plain "View setup guide" link
  to `siteConfig.urls.docs` (placeholder URL until go-live). Hindi added for it and for "Set up".
- admin-routes allow-list lowered (links in settings, domains, payments, notifications, shipping now read
  `routes`).

Round 2
- `SettingsTable` (+ row and cell) wraps the shared table look (40px header, 48px rows, hairlines, centred
  status chips, `RowActionsCell`, "Showing 1-n of n"): team members, invites, roles, domains, DNS records,
  locations, shipping zones and notification messages now use it.
- Payments wizard: header with "Step n of 5" and Skip, segmented progress, step card; methods list on
  hairline rows. Shipping "When orders go out" on rows with a switch for COD. Notifications: one table per
  message group (switch + On/Off chip, preview and test in the row actions).
- Header Save now also on Taxes & GST (state lifted with `onSaveState`), Shipping and Payments advanced.
  Notifications has no header Save: each switch saves itself and the sender email has its own form.

Not done / notes
- Notifications "Customer messages / Staff alerts" tabs from Figma `350:8036`: kept the existing groups.
- "Updated" column from Figma not shown (no per-message updated date exists).
- Staff copy has no Hindi overlay (none existed); new "Role" and "Members" column labels are English.
- Policy "Generate with AI": no policy drafting endpoint exists (`api.ai` has product/blog writers only), omitted.
- AI access (MCP) page: no MCP backend, skipped.
- No browser check (no login available to the agent).
