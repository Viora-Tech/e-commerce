# Apps audit, Phase 1b group 1

- New `docs/audits/2026-11-11-apps-group-1.md`: code-level and local-test audit of GST invoices,
  Shiprocket, RapidShyp, Reviews, WhatsApp, Amazon SES and Inbox. Per app: features, test
  coverage, bugs found and fixed, gaps, and a short live check for the owner.
- No `tested: true` was flipped; that waits for the owner's live check.
- Bugs filed and fixed in separate PRs: #1550 (GST), #1551-#1553 (WhatsApp), #1554 (SES),
  #1555-#1557 (Shiprocket, RapidShyp).
- Three open questions for the owner are at the end of the audit.
