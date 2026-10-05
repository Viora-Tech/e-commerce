# Admin UI revamp: plan

**Status:** planned, owner decision (2026-09-28, confirmed 2026-10-05): a **major UI improvement
of the whole admin is coming**. Until then, UI work in feature PRs stays **functional and
consistent with today's look**; don't spend effort on page-by-page polish that the revamp will
redo. Bugs that make a screen wrong or unreadable (e.g. dark-mode contrast, misleading status)
still get fixed now.

## Goal

A modern, calm admin in the spirit of the editor pass (#201, #212): Saleor Dashboard structure on
shadcn/Base UI, Shopify 2026 information architecture, Linear/Framer-level polish, user-chosen
accent colour, full dark-mode parity, plain words, Hindi, mobile-first (the "50-year-old test").

## Design system first

Write `docs/design/admin-design-system.md` before touching pages, from the #201 rules:

- One icon set and weight (Phosphor regular/light; 16px in the sidebar, 14px inline).
- Type: 13px body, 12px labels, 11px muted sentence-case section headings (in rem).
- 4px spacing grid; 8px row and 12px panel radii; 32px table rows; hairline token borders.
- Soft hover; selected = tinted background + accent bar; 150–200ms motion with a strong ease-out,
  reduced-motion safe (emil-design-eng + review-animations on every change).
- Tokens only (`globals.css` variables), no raw colours; dark mode checked for every component.
- Shared patterns: page header, resource table (Data Table), empty states, progress/status
  (the importer's "What's left" and run pages are the reference for status design),
  confirm dialogs, toasts, forms, settings cards.

## Batches (one PR each, into `dev`, each checked in the browser before the PR)

| Batch | Pages |
| --- | --- |
| B1 | Home, Orders list/detail, Products list, Customers |
| B2 | Inventory, Collections, Discounts, Drafts, Returns, Shipments |
| B3 | Analytics/Reports, Growth, Content (files, menus, content types), Online Store |
| B4 | Apps (Shopify importer, couriers, payments), Settings (staff, domains, storage), Onboarding, Login, Report-a-bug |

## Rules

- Restyle only: keep behaviour, routes and data the same; behaviour changes go in their own PRs.
- Every batch is seen in the browser (light + dark, desktop + 390px) against the references before
  the PR; the owner reviews on the test server.
- Shared UI root components (`packages/ui/`) change only as part of the design system, never to
  fix one page.
- Order: after the go-live backlog and the website builder discussion, unless the owner pulls it
  forward.
