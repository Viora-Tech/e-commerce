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

Not done / notes
- Table-style cards (staff members, roles, invites, domains list, DNS records, locations list, zones,
  notifications message rows, payments methods) keep their table layout inside the shared `Card`.
- Header Save is not wired on Taxes & GST (the form sits in a tab child), Notifications, Shipping or
  Payments advanced; the floating bar covers them.
- Policy "Generate with AI": no policy drafting endpoint exists (`api.ai` has product/blog writers only), so omitted.
- AI access (MCP) page: no MCP backend exists, skipped.
- No browser check (no login available to the agent).
