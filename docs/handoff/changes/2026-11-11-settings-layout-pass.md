# Settings layout pass (11 November 2026)

Audit: `docs/design/settings-audit-2026-11-11.md`.

- `SettingsDrill` takes an optional `header` (title, subtitle, actions, save, notice). With it,
  the drill draws the page header itself: the page title on the row list; inside an open row,
  the row's title with one "‹ Page" link above it, in place of the separate back button that sat
  under the page header. Rows can add `help` (the line under the title) and `actions` (buttons in
  the header, so no floating button rows). `before` / `after` show only on the row list.
  Without `header` nothing changes (Staff and Approvals still use the old form).
- `SettingsCard` leaves out a title that repeats the open row's title (the header already
  says it); its help line stays. It is now a client component (it reads the drill context).
- `PageHeader.back` and `BackLink` accept `onClick` as well as `href`.
- Moved to the one header: Store details, Plan & billing, Payments, Checkout, Shipping &
  delivery, Returns, GST & invoices, Costs for profit, Customer accounts, Privacy, Policies,
  Notifications, AI, MCP & API. Notifications' hand-made detail headings are gone; their help
  lines are the header subtitle.
- Page roots use `gap-4` everywhere (were 3, 5 or 6 on some pages). Store health keeps its intro
  in the subtitle with the "checked" line under it, instead of a loose caption.
- Policies: "Edit store details" is the card footer, not a floating row. Billing: the Payment
  and Downgrade details are SettingsCards; Downgrade's button is the card footer.
- Data request pages use `routes.settings.*` instead of hardcoded hrefs.

Browser check still owed (no dev server was run): open a row on each page above and check one
heading, one back link, Save in the header, and the phone layout.
