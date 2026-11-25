# Apps v2 check: Reviews, WhatsApp, Amazon SES, Inbox (24 Nov)

Same check as GST, Shiprocket and RapidShyp last week: read each app for logic bugs, wrong
states, duplicate sends, store isolation and webhook checks. Branch
`fix/apps-v2-reviews-whatsapp-ses-inbox`.

## Fixed
- **Inbox AI reply after a person stepped in** (`core/src/inbox/ai-agent.ts`): the AI decided
  before the model call and posted after it. A staff reply, close or take-over during those
  seconds still got an AI message. It now loads the chat again in the posting transaction and
  stays quiet (`skipped: changed_meanwhile`) when it may no longer answer.
- **Chat email sweep missed new chats on busy days** (`core/src/inbox/chat-emails.ts`): it
  scanned the 200 oldest chats of the last day; it now scans the newest first.
- **WhatsApp review request links** (`plugin-reviews/src/submit.ts`, `reviews.ts`,
  `storefront/src/lib/reviews.ts`): for an order with only a phone, the form hid the email field
  and the review was then refused for having no email. `requestLinkBuyer` now says whether the
  order has an email and the form asks when it has none. The review also closes that order's
  request by order id, so no reminder follows it (the request row has no email to match).
- **Review request sent twice on retry** (`core/src/notifications/deliver-email.ts`,
  `worker/src/notifications.ts`): with email and WhatsApp on, a WhatsApp failure retried the
  whole job and re-sent the email. The job keeps `sentChannels` (`job.updateData`) and
  `deliverMessageTo` skips them (`skipChannels`).
- **Reviews list error read as empty** (`admin/.../reviews/reviews-page.tsx`): a failed read
  now shows "Could not load the reviews" with Try again (existing copy, Hindi included).

## Owner decisions, built the same day
- **Reply to a hidden review** never emails the reviewer (`replyToReview`, `replyEmailData`).
- **Store totals and review walls** (`storeReviewTotals`, `storeReviewFeed`, `storeWidgetReviews`)
  leave out reviews of draft and archived products (`plugin-reviews/src/live-product.ts`).
- **Load failures vs 404**: `useLoad` now also returns `notFound` (the API's NOT_FOUND); the review
  page shows "Could not load this review" with Try again for anything else.
- **WhatsApp delivery reports**: migration **0268_whatsapp_delivery_reports** adds
  `notification.delivery_status` / `delivery_at` and partial indexes on `provider_ref`
  (notification, marketing_message). The Meta webhook saves delivered, read and failed on the
  message (never downgrading read; failed marks the row failed with Meta's words; campaign rows
  get failed or opened). The WhatsApp log shows Delivered and Read.
  `core/src/platform-apps/whatsapp-reports.ts`.
- **WhatsApp STOP replies**: STOP, STOP ALL, UNSUBSCRIBE, OPT OUT (any case, alone in the
  message; not CANCEL) turn WhatsApp consent off for that store's customers with the phone,
  consent source `whatsapp_reply`. Only for accounts linked through Embedded Signup (the Meta
  webhook names the account); a pasted-token account has no webhook to us.
- **Store's own SES bounces**: SES app fields Configuration set and SNS topic ARN; sends name the
  set and carry the `store-id` tag; the topic posts to `/webhooks/email/ses/<store id>`, which
  accepts only that store's saved topic (`handleStoreSesSnsWebhook`).
- **SES check after save**: `notifications.checkSes` (`checkSesSetup` in notifications-ses):
  errors for wrong keys, permission, region, paused sending, From not verified, missing
  configuration set; sandbox only warns. Shown on the Connect page with the subscription address.
- **Suppressed addresses**: recorded as `skipped` (`sendStatus` in email-suppression/guard), not
  failed and never retried; campaigns do not count them, automation steps move on.
- **Inbox guest emails**: unchanged, as decided.

## Tests
`core`: `inbox/ai-agent.test.ts`, `inbox/chat-emails.test.ts`, `notifications/deliver.test.ts`.
`plugin-reviews`: `test/requests.test.ts`. Each new test fails on the old code.
Owner-decision tests: `plugin-reviews` `test/reviews.test.ts`, `test/widgets.test.ts`; `core`
`platform-apps/whatsapp-reports.test.ts`, `email-suppression/sns.test.ts` and `service.test.ts`,
`notifications/deliver.test.ts`, `notifications/ses-check.test.ts`; `notifications-ses`
`test/check.test.ts`, `test/ses.test.ts`; admin `hooks/use-load.test.tsx`.
