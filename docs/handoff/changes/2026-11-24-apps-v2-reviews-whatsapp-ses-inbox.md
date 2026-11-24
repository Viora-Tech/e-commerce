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

## Left for the owner (see the PR report)
WhatsApp delivery statuses and inbound STOP replies are not processed; a store's own SES
account sends no bounces or complaints to suppression; Inbox emails go to an unverified typed
address; replies to hidden reviews still email the reviewer.

## Tests
`core`: `inbox/ai-agent.test.ts`, `inbox/chat-emails.test.ts`, `notifications/deliver.test.ts`.
`plugin-reviews`: `test/requests.test.ts`. Each new test fails on the old code.
