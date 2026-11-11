# WhatsApp: 91 on Indian numbers, no empty values, a deadline on Graph calls (#1551, #1552, #1553)

`packages/notifications-whatsapp/src/whatsapp.ts`:
- `whatsappTo` turns the stored phone into Meta's `to`. Checkout keeps an Indian mobile as 10
  digits (`normaliseMobile`), so a 10-digit mobile (or one with a leading 0) gets `91`; a number
  stored with `+` (abroad) keeps its own country code. Before, Indian shoppers' messages went to
  `98xxxxxxxx` with no country code.
- An empty template value is sent as `-` (Meta refuses an empty parameter), like marketing sends.
- Every Graph call (send, list templates) has a 15 s `AbortSignal.timeout`; a timeout is a failed
  `SendResult`. The constructor takes `{ timeoutMs }` for tests.
- Tests: three new cases in `test/whatsapp.test.ts`.
- Found by the Phase 1b group 1 audit: `docs/audits/2026-11-11-apps-group-1.md`.
