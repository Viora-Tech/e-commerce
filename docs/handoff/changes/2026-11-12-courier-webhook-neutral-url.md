# Courier webhook: a neutral URL without the courier's name (#1568)

- New alias route in the worker: `POST /webhooks/shipments/c/:code/:storeId`
  (`apps/worker/src/shipments-webhook.ts`), same handler, rate limit and authentication as
  `/webhooks/shipments/:provider/:storeId`, which keeps working. An unknown code gets the same
  generic rejection as any bad call.
- Codes live in `packages/core/src/shipping/webhook-path.ts` (`COURIER_WEBHOOK_CODES`: `sr`
  Shiprocket, `dl` Delhivery, `xb` Xpressbees, `ek` Ekart, `sf` Shadowfax), exported as the
  pure subpath `@commerce/core/courier-webhook-path`. Codes are permanent once pasted: only add.
- `courierWebhookPath(providerId, storeId)` gives Shiprocket the alias and every other courier
  the named path; the admin `CourierWebhookCard` and Shiprocket's Advanced fields use it.
- Why: Shiprocket's webhook form is said to refuse URLs containing "shiprocket"
  (audit `docs/audits/2026-11-11-apps-group-1.md`, open question 2).
- Tests: `packages/core/src/shipping/webhook-path.test.ts`, `apps/worker/src/webhook-reply.test.ts`.
- **Owed:** browser check of the Shiprocket Overview card, and one live "Test and Save" in
  Shiprocket's webhook form with the new URL.
