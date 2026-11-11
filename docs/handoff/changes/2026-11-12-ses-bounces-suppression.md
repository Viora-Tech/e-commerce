# SES bounces and complaints: SNS webhook and a per-store suppression list (#1569)

**Migration 0239** (`0239_email_suppression`): tables `email_suppression` and
`email_feedback_event` (RLS), SECURITY DEFINER `store_for_sender_domain(text)` and
`store_for_email_tag(uuid)`. If another PR also took 0239, renumber this one (file, journal tag).

- **Receiving**: worker `POST /webhooks/email/ses` (`apps/worker/src/email-feedback.ts`) calls
  core `handleSesSnsWebhook` (`packages/core/src/email-suppression/webhook.ts`): SNS envelope only,
  exact topic `SES_EVENTS_TOPIC_ARN` (unset: refuses all), signature v1/v2 checked against the
  certificate from `https://sns.<region>.amazonaws.com/…pem` only, SubscriptionConfirmation
  confirmed by visiting its SubscribeURL (SNS host + `Action=ConfirmSubscription` only).
- **Rules** (`service.ts`): Permanent bounce or complaint, suppressed at once; Transient /
  Undetermined: 3 within 14 days (`SOFT_BOUNCE_LIMIT`, `SOFT_BOUNCE_WINDOW_DAYS`), counted after
  the last Allow again. Idempotent per store + SNS MessageId + address.
- **Store**: `store-id` SES tag (every platform SES send now carries it, plus
  `ConfigurationSetName` from `SES_CONFIGURATION_SET`), else the sender domain's store.
- **Skipping**: `storeNotificationChannels` wraps email channels with `withSuppressionGuard`
  (`guard.ts`); a suppressed send returns `suppressed: <reason>: …` and is logged as failed.
  Covers order messages, one-off emails, gift cards, campaigns, automations. **Sign-in codes and
  links still go out** (owner to confirm).
- **Admin**: customer page notice + Allow again (`email-suppression-notice.tsx`); list under
  Settings › Notifications › Sender email (`suppressed-emails-list.tsx`). Copy
  `data/email-suppression.ts` + Hindi.
- **Env**: new `SES_EVENTS_TOPIC_ARN` (worker). `SES_CONFIGURATION_SET` must name a set that
  exists, or SES refuses sends.
- **Erasure** deletes the customer's rows in both tables.
- **Docs**: developer docs Email sending › Bounces and complaints (with the AWS setup checklist);
  merchant guide Sender email › Addresses that bounce or complain.
- Tests: `packages/core/src/email-suppression/{sns,guard,service}.test.ts` (SNS fixtures signed
  offline with a discarded key, no AWS), `sender-email/platform.test.ts`,
  `notifications-ses/test/ses.test.ts`.
- **Owed**: owner's AWS setup (topic, subscription, configuration set, env), one live bounce
  through `bounce@simulator.amazonses.com`, browser check of both admin screens.
- Not covered: a store's own SES app, Resend; retention of `email_feedback_event` (no pruning yet).
