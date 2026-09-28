# Marketing sends only to the consenting customer's own contact

**Marketing recipient check** (28 September 2026, security fix, no migration). Consent is
checked on a customer, so a message sent under it must go to that customer's own address. The
checkout contact on a basket or order is typed and unverified: someone could enter a
subscriber's email and a stranger's phone and have the abandoned-checkout WhatsApp reach the
stranger.

- **Automations** (`packages/core/src/marketing/automations.ts`): an email or WhatsApp
  marketing step sends only when the address equals the run customer's stored email
  (trimmed, lower-cased) or decrypted phone (`normalisePhone`). Otherwise the message row is
  `skipped` with error `recipient_mismatch`. A customer with no phone stored gets no WhatsApp
  marketing to a typed phone. Helper: `marketing/recipient.ts` (`recipientIsCustomers`).
- **COD**: only the first step of a `cod_order_placed` automation, when it is WhatsApp, counts
  as an order update that needs no consent (`isTransactionalStep` in `automation-steps.ts`).
  That step still goes to the order's phone. Any step a merchant adds after it goes through
  consent and the recipient check. The editor still lets merchants add steps. The trigger card
  copy now says later steps are marketing.
- **Manual "Send recovery"** (`deliverCartRecovery` in `notifications/deliver.ts`): a guest
  nobody knows still gets the one nudge. The nudge is refused on a channel when a customer the
  store knows for it has not said yes on that channel. Known customers are the basket's
  signed-in customer and whoever owns that email or phone (found by blind index, or by
  plaintext for rows not yet backfilled). Phone channels count as WhatsApp. If every channel
  is refused, the API returns PRECONDITION_FAILED with a message.

Tests: `marketing/recipient.test.ts` is pure (no DB). New DB cases in `automations.test.ts`
("recipient" describe) were not run here because there was no Postgres.
